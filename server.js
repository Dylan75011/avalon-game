const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 静态文件
app.use(express.static(path.join(__dirname, 'public')));

// 数据库文件路径
const DB_FILE = path.join(__dirname, 'data', 'game.db');

let db = null;

// 初始化数据库
async function initDb() {
  const SQL = await initSqlJs();
  
  // 尝试加载已有数据库
  try {
    if (fs.existsSync(DB_FILE)) {
      const buffer = fs.readFileSync(DB_FILE);
      db = new SQL.Database(buffer);
      console.log('✅ 已加载已有数据库');
    } else {
      db = new SQL.Database();
      console.log('✅ 创建新数据库');
    }
  } catch (e) {
    db = new SQL.Database();
    console.log('✅ 创建新数据库（错误:', e.message, ')');
  }
  
  // 创建表
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      phone TEXT PRIMARY KEY,
      username TEXT,
      total_points INTEGER DEFAULT 0,
      games_played INTEGER DEFAULT 0,
      games_won INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS rooms (
      room_id TEXT PRIMARY KEY,
      host_phone TEXT,
      game_status TEXT DEFAULT 'waiting',
      current_round INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS room_players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT,
      phone TEXT,
      role TEXT,
      status TEXT DEFAULT 'alive',
      is_leader INTEGER DEFAULT 0,
      joined_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS game_rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT,
      round_number INTEGER,
      leader_phone TEXT,
      team_selected TEXT,
      mission_result TEXT,
      fail_votes INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  saveDb();
  console.log('✅ 数据库表初始化完成');
}

// 保存数据库到文件
function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_FILE, buffer);
}

// Socket.io 连接处理
io.on('connection', (socket) => {
  console.log('新连接:', socket.id);

  // 用户注册/登录
  socket.on('register', (userData, callback) => {
    const { phone, username } = userData;
    
    if (!phone || phone.length !== 11) {
      callback({ success: false, message: '请输入11位手机号' });
      return;
    }

    try {
      // 检查用户是否存在
      const existing = db.exec(`SELECT * FROM users WHERE phone = '${phone}'`);
      const isNew = existing.length === 0 || existing[0].values.length === 0;
      
      if (isNew) {
        // 新用户
        db.run(`INSERT INTO users (phone, username, total_points, games_played, games_won) VALUES (?, ?, 0, 0, 0)`, [phone, username || '玩家' + phone.slice(-4)]);
      } else if (username) {
        // 老用户但提供了新昵称
        db.run(`UPDATE users SET username = ? WHERE phone = ?`, [username, phone]);
      }
      
      saveDb();
      
      // 获取用户信息
      const userResult = db.exec(`SELECT * FROM users WHERE phone = '${phone}'`);
      const user = {
        phone: userResult[0].values[0][0],
        username: userResult[0].values[0][1],
        points: userResult[0].values[0][2],
        games_played: userResult[0].values[0][3],
        games_won: userResult[0].values[0][4]
      };
      
      socket.phone = phone;
      socket.username = user.username;
      
      callback({ success: true, user, isNew });
      
    } catch (err) {
      callback({ success: false, message: err.message });
    }
  });

  // 获取用户信息
  socket.on('getUser', (data, callback) => {
    const phone = data.phone || data;
    if (!phone) {
      callback(null);
      return;
    }
    const result = db.exec(`SELECT * FROM users WHERE phone = '${phone}'`);
    if (result.length > 0 && result[0].values.length > 0) {
      callback({
        phone: result[0].values[0][0],
        username: result[0].values[0][1],
        total_points: result[0].values[0][2],
        games_played: result[0].values[0][3],
        games_won: result[0].values[0][4]
      });
    } else {
      callback(null);
    }
  });

  // 获取排行榜
  socket.on('getRanking', (callback) => {
    const result = db.exec(`
      SELECT phone, username, total_points, games_played, games_won
      FROM users
      ORDER BY total_points DESC
      LIMIT 20
    `);
    
    if (result.length === 0) {
      callback([]);
      return;
    }
    
    const ranking = result[0].values.map(row => ({
      phone: row[0],
      username: row[1],
      total_points: row[2],
      games_played: row[3],
      games_won: row[4]
    }));
    
    callback(ranking);
  });

  // 创建房间
  socket.on('createRoom', (data, callback) => {
    const { phone, playerCount } = data;
    const roomId = generateInviteCode();
    const requiredPlayers = playerCount || 5; // 默认5人局
    
    try {
      db.run(`INSERT INTO rooms (room_id, host_phone, game_status) VALUES (?, ?, 'waiting')`, [roomId, phone]);
      db.run(`INSERT INTO room_players (room_id, phone, is_leader) VALUES (?, ?, 1)`, [roomId, phone]);
      saveDb();
      
      // 内存中管理房间状态
      const room = {
        id: roomId,
        host: phone,
        requiredPlayers: requiredPlayers,
        players: [{ phone, username: socket.username || '玩家' + phone.slice(-4), socketId: socket.id, isLeader: true, status: 'alive', role: null }],
        status: 'waiting',
        currentRound: 0,
        gameData: {}
      };
      
      rooms.set(roomId, room);
      socket.join(roomId);
      socket.roomId = roomId;

      callback({ 
        success: true, 
        roomId,
        players: room.players
      });
    } catch (err) {
      callback({ success: false, message: err.message });
    }
  });

  // 加入房间
  socket.on('joinRoom', (data, callback) => {
    const { roomId, phone } = data;
    const room = rooms.get(roomId);

    if (!room) {
      callback({ success: false, message: '房间不存在' });
      return;
    }

    if (room.players.length >= 10) {
      callback({ success: false, message: '房间已满' });
      return;
    }

    if (room.status !== 'waiting') {
      callback({ success: false, message: '游戏已开始' });
      return;
    }

    const existingPlayer = room.players.find(p => p.phone === phone);
    if (existingPlayer) {
      existingPlayer.socketId = socket.id;
    } else {
      room.players.push({ phone, username: socket.username || '玩家' + phone.slice(-4), socketId: socket.id, isLeader: false, status: 'alive', role: null });
      db.run(`INSERT INTO room_players (room_id, phone) VALUES (?, ?)`, [roomId, phone]);
    }

    socket.join(roomId);
    socket.roomId = roomId;
    saveDb();

    io.to(room.id).emit('playerJoined', {
      players: room.players
    });

    callback({ success: true, players: room.players, status: room.status });
  });

  // 离开房间
  socket.on('leaveRoom', (data, callback) => {
    const { roomId, phone } = data;
    handleLeaveRoom(socket, roomId, phone);
    callback({ success: true });
  });

  // 开始游戏
  socket.on('startGame', (data, callback) => {
    const { roomId } = data;
    const room = rooms.get(roomId);

    if (!room) {
      callback({ success: false, message: '房间不存在' });
      return;
    }

    const required = room.requiredPlayers || 5;
    if (room.players.length < required) {
      callback({ success: false, message: `需要${required}人才能开始，当前${room.players.length}人` });
      return;
    }

    assignRoles(room);
    room.status = 'in_progress';
    room.currentRound = 1;
    
    db.run(`UPDATE rooms SET game_status = 'in_progress', current_round = 1 WHERE room_id = ?`, [roomId]);
    saveDb();

    // 发送游戏开始事件给每个玩家，包含各自的可见信息
    room.players.forEach(player => {
      io.to(player.socketId).emit('gameStarted', {
        players: room.players.map(p => ({ phone: p.phone, username: p.username, avatar: p.avatar })),
        round: 1,
        myRole: player.role,
        mySees: player.sees, // 该玩家能看到的身份信息
        playerCount: room.players.length
      });
    });

    callback({ success: true });
  });

  // 提交团队
  socket.on('submitTeam', (data, callback) => {
    const { roomId, teamIndices, leaderPhone } = data;
    const room = rooms.get(roomId);

    if (!room) {
      callback({ success: false, message: '房间不存在' });
      return;
    }

    room.gameData.pendingTeam = teamIndices;
    room.gameData.votes = {};
    saveDb();

    io.to(room.id).emit('teamProposed', {
      teamIndices,
      leaderPhone
    });

    callback({ success: true });
  });

  // 投票
  socket.on('vote', (data, callback) => {
    const { roomId, phone, vote } = data;
    const room = rooms.get(roomId);

    if (!room || !room.gameData.pendingTeam) {
      callback({ success: false, message: '无效操作' });
      return;
    }

    room.gameData.votes[phone] = vote;
    saveDb();

    const votesNeeded = room.players.length;
    const currentVotes = Object.keys(room.gameData.votes).length;

    if (currentVotes >= votesNeeded) {
      const approveVotes = Object.values(room.gameData.votes).filter(v => v === 'approve').length;
      const isApproved = approveVotes > votesNeeded / 2;

      io.to(room.id).emit('voteResult', {
        votes: room.gameData.votes,
        isApproved
      });
    }

    callback({ success: true });
  });

  // 执行任务
  socket.on('submitMission', (data, callback) => {
    const { roomId, phone, result } = data;
    const room = rooms.get(roomId);

    if (!room) {
      callback({ success: false, message: '房间不存在' });
      return;
    }

    room.gameData.missionResults = room.gameData.missionResults || {};
    room.gameData.missionResults[phone] = result;
    saveDb();

    const teamIndices = room.gameData.pendingTeam;
    const teamPlayers = teamIndices.map(i => room.players[i]);
    const votesNeeded = teamPlayers.length;
    const currentVotes = Object.keys(room.gameData.missionResults).length;

    if (currentVotes >= votesNeeded) {
      const fails = Object.values(room.gameData.missionResults).filter(r => r === 'fail').length;
      const missionSuccess = fails === 0;

      // 记录任务结果
      room.gameData.missionHistory = room.gameData.missionHistory || [];
      room.gameData.missionHistory.push(missionSuccess);
      
      const successes = room.gameData.missionHistory.filter(s => s).length;
      const failures = room.gameData.missionHistory.filter(s => !s).length;

      io.to(room.id).emit('missionResult', {
        results: room.gameData.missionResults,
        success: missionSuccess,
        fails,
        successes,
        failures,
        round: room.currentRound
      });

      // 检查胜负
      setTimeout(() => {
        checkWinCondition(room, io);
      }, 1000);

      updateGameStats(room, missionSuccess);
    }

    callback({ success: true });
  });

  // 刺客刺杀
  socket.on('assassinate', (data, callback) => {
    const { roomId, targetPhone } = data;
    const room = rooms.get(roomId);
    
    if (!room) {
      callback({ success: false, message: '房间不存在' });
      return;
    }
    
    const assassin = room.players.find(p => p.role === 'assassin');
    if (assassin.phone !== socket.phone) {
      callback({ success: false, message: '你不是刺客' });
      return;
    }
    
    const target = room.players.find(p => p.phone === targetPhone);
    if (!target) {
      callback({ success: false, message: '目标不存在' });
      return;
    }
    
    const success = target.role === 'merlin';
    
    io.to(room.id).emit('assassinationResult', {
      success
    });
    
    // 游戏结束
    setTimeout(() => {
      if (success) {
        endGame(room, io, 'evil', '刺客成功刺杀梅林，坏人胜利！');
      } else {
        endGame(room, io, 'good', '刺客刺杀失败，好人胜利！');
      }
    }, 2000);
    
    callback({ success: true });
  });

  // 身份操作 - 查看队友
  socket.on('checkAlly', (data, callback) => {
    const { roomId, phone } = data;
    const room = rooms.get(roomId);
    
    if (!room) {
      callback({ success: false, message: '房间不存在' });
      return;
    }
    
    const player = room.players.find(p => p.phone === phone);
    if (!player) {
      callback({ success: false, message: '玩家不存在' });
      return;
    }
    
    callback({ success: true, sees: player.sees || [] });
  });

  // 身份操作 - 指认目标（刺客专用）
  socket.on('accuse', (data, callback) => {
    const { roomId, phone, targetPhone } = data;
    const room = rooms.get(roomId);
    
    if (!room) {
      callback({ success: false, message: '房间不存在' });
      return;
    }
    
    const player = room.players.find(p => p.phone === phone);
    const target = room.players.find(p => p.phone === targetPhone);
    
    if (!player || !target) {
      callback({ success: false, message: '玩家不存在' });
      return;
    }
    
    if (player.role !== 'assassin') {
      callback({ success: false, message: '只有刺客可以指认' });
      return;
    }
    
    const isEvil = ['assassin', 'minion', 'oberon'].includes(target.role);
    callback({ 
      success: true, 
      result: isEvil ? '正确！他是坏人' : '错误！他是好人',
      isCorrect: isEvil,
      targetRole: target.role
    });
  });

  // 测试模式 - 快速开始
  socket.on('startTestGame', (data, callback) => {
    const { roomId, phone } = data;
    const room = rooms.get(roomId);
    
    if (!room) {
      callback({ success: false, message: '房间不存在' });
      return;
    }
    
    // 填充AI玩家
    const aiNames = ['小明', '小红', '小刚', '小强'];
    for (let i = 0; i < 4; i++) {
      const aiPhone = 'test_' + Date.now() + '_' + i;
      room.players.push({
        phone: aiPhone,
        username: aiNames[i],
        socketId: null,
        isLeader: false,
        status: 'alive',
        role: null
      });
    }
    
    // 开始游戏
    assignRoles(room);
    room.status = 'in_progress';
    room.currentRound = 1;
    room.gameData = { currentRound: 1, missionResults: {} };
    
    // 分配角色
    room.players.forEach(player => {
      player.sees = getPlayerVision(player, room.players);
    });
    
    // 发送游戏开始
    room.players.forEach(player => {
      if (player.socketId) {
        io.to(player.socketId).emit('gameStarted', {
          players: room.players.map(p => ({ phone: p.phone, username: p.username, avatar: p.avatar })),
          round: 1,
          myRole: player.role,
          mySees: player.sees,
          playerCount: room.players.length
        });
      }
    });
    
    callback({ success: true });
  });

  // 房主解散游戏
  socket.on('hostEndGame', (data, callback) => {
    const { roomId, phone } = data;
    const room = rooms.get(roomId);
    
    if (!room) {
      callback({ success: false, message: '房间不存在' });
      return;
    }
    
    if (room.host !== phone) {
      callback({ success: false, message: '只有房主可以解散游戏' });
      return;
    }
    
    // 通知所有玩家游戏解散
    io.to(roomId).emit('gameDismissed', { reason: '房主解散了游戏' });
    
    // 清理房间
    rooms.delete(roomId);
    db.run('DELETE FROM rooms WHERE room_id = ?', [roomId]);
    saveDb();
    
    callback({ success: true });
  });

  // 断开连接
  socket.on('disconnect', () => {
    console.log('断开连接:', socket.id);
    if (socket.roomId && socket.phone) {
      handleLeaveRoom(socket, socket.roomId, socket.phone);
    }
  });
});

// 内存中的房间状态
const rooms = new Map();

// 处理离开房间
function handleLeaveRoom(socket, roomId, phone) {
  const room = rooms.get(roomId);
  if (!room) return;

  room.players = room.players.filter(p => p.phone !== phone);
  socket.leave(roomId);

  if (room.players.length === 0) {
    rooms.delete(roomId);
    db.run(`DELETE FROM rooms WHERE room_id = ?`, [roomId]);
  } else {
    if (room.host === phone) {
      room.host = room.players[0].phone;
      room.players[0].isLeader = true;
    }

    io.to(room.id).emit('playerLeft', {
      players: room.players,
      newHost: room.host
    });
  }
  saveDb();
}

// 检查胜负条件
function checkWinCondition(room, io) {
  if (!room || !room.players || !room.gameData) {
    console.error('checkWinCondition: room data invalid');
    return;
  }
  
  const history = room.gameData.missionHistory || [];
  const successes = history.filter(s => s).length;
  const failures = history.filter(s => !s).length;
  
  // 3次失败 = 坏人胜利
  if (failures >= 3) {
    endGame(room, io, 'evil', `任务失败${failures}次（成功${successes}次），坏人胜利！`);
    return;
  }
  
  // 3次成功 = 进入刺杀阶段
  if (successes >= 3) {
    // 通知刺客选择梅林
    const assassin = room.players.find(p => p.role === 'assassin');
    if (assassin) {
      io.to(room.id).emit('assassinationPhase', {
        message: '好人已完成3轮任务，刺客选择梅林！'
      });
    }
    return;
  }
  
  // 继续下一轮
  room.currentRound++;
  room.gameData.votes = {};
  room.gameData.missionResults = {};
  room.gameData.pendingTeam = null;
  room.gameData.leaderIndex = (room.gameData.leaderIndex + 1) % room.players.length;
  
  const nextLeader = room.players[room.gameData.leaderIndex];
  if (!nextLeader) {
    console.error('No next leader found');
    return;
  }
  
  io.to(room.id).emit('nextRound', {
    round: room.currentRound,
    leader: nextLeader.username
  });
}

// 结束游戏
function endGame(room, io, winner, reason) {
  if (!room || !room.players) {
    console.error('endGame: room data invalid');
    return;
  }
  
  const goodPlayers = room.players.filter(p => ['merlin', 'percival', 'loyalist'].includes(p.role));
  const evilPlayers = room.players.filter(p => ['assassin', 'minion', 'oberon'].includes(p.role));
  
  goodPlayers.forEach(p => {
    const won = winner === 'good';
    db.run(`UPDATE users SET points = points + ?, games_played = games_played + 1, games_won = games_won + ? WHERE phone = ?`, 
      [won ? 100 : 20, won ? 1 : 0, p.phone]);
  });
  
  evilPlayers.forEach(p => {
    const won = winner === 'evil';
    db.run(`UPDATE users SET points = points + ?, games_played = games_played + 1, games_won = games_won + ? WHERE phone = ?`, 
      [won ? 100 : 20, won ? 1 : 0, p.phone]);
  });
  
  saveDb();
  
  io.to(room.id).emit('gameEnded', {
    winner,
    reason,
    roles: room.players.map(p => ({ username: p.username })) // 不显示角色防止泄漏
  });
  
  room.status = 'ended';
}

// 生成邀请码
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 保存数据库
function saveDb() {
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync('data/game.db', buffer);
  } catch (err) {
    console.error('保存数据库失败:', err);
  }
}

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`阿瓦隆游戏服务器运行在 http://localhost:${PORT}`);
});
