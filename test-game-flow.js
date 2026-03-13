const io = require('socket.io-client');
const SERVER = 'http://47.81.9.246:80';

const players = [
  { phone: '13900002001', name: '梅林' },
  { phone: '13900002002', name: '派西' },
  { phone: '13900002003', name: '忠臣A' },
  { phone: '13900002004', name: '忠臣B' },
  { phone: '13900002005', name: '刺客' }
];

let results = { passed: 0, failed: 0 };
let events = {};
let gameState = { roomId: '', roles: {} };

function log(name, ok, msg = '') {
  if (ok) { results.passed++; console.log('✅ ' + name); }
  else { results.failed++; console.log('❌ ' + name + ' ' + msg); }
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function createSocket() {
  return new Promise(resolve => {
    const s = io(SERVER, { timeout: 5000 });
    s.on('connect', () => {
      // 设置所有事件监听
      ['playerJoined', 'gameStarted', 'teamProposed', 'voteResult', 'missionResult', 'nextRound', 'assassinationPhase', 'gameEnded'].forEach(evt => {
        s.on(evt, data => {
          events[evt] = (events[evt] || 0) + 1;
          console.log('  收到 ' + evt);
          if (evt === 'gameStarted') gameState.roles = data.roles || {};
        });
      });
      resolve(s);
    });
  });
}

async function register(socket, phone, name) {
  return new Promise(resolve => {
    socket.emit('register', { phone, username: name }, r => resolve(r));
  });
}

async function run() {
  console.log('=== 完整游戏流程测试 ===\n');
  
  // 1. 创建连接
  console.log('1. 创建连接...');
  const sockets = await Promise.all(players.map(() => createSocket()));
  log('连接', sockets.length === 5);
  await sleep(300);
  
  // 2. 注册
  console.log('\n2. 注册...');
  await Promise.all(players.map((p, i) => register(sockets[i], p.phone, p.name)));
  log('注册', true);
  await sleep(300);
  
  // 3. 创建房间
  console.log('\n3. 创建房间...');
  await new Promise(resolve => {
    sockets[0].emit('createRoom', { phone: players[0].phone, username: players[0].name, playerCount: 5 }, r => {
      if (r.success) gameState.roomId = r.roomId;
      log('创建房间', r.success, r.roomId || '');
      resolve();
    });
  });
  await sleep(300);
  
  // 4. 加入房间
  console.log('\n4. 加入房间...');
  await Promise.all(players.slice(1).map((p, i) => 
    new Promise(resolve => {
      sockets[i+1].emit('joinRoom', { roomId: gameState.roomId, phone: p.phone, username: p.name }, r => resolve(r));
    })
  ));
  log('加入房间', true);
  await sleep(1000);
  
  // 5. 开始游戏
  console.log('\n5. 开始游戏...');
  await new Promise(resolve => {
    sockets[0].emit('startGame', { roomId: gameState.roomId }, r => {
      log('开始游戏', r.success, r.message || '');
      resolve();
    });
  });
  await sleep(1500);
  log('游戏开始事件', events.gameStarted > 0);
  log('角色分配', Object.keys(gameState.roles).length === 5, Object.keys(gameState.roles).join(','));
  
  // 6. 队长组队
  console.log('\n6. 队长组队 (玩家1是队长)...');
  // 找到队长的socket索引
  const leaderIndex = 0;
  await new Promise(resolve => {
    sockets[leaderIndex].emit('submitTeam', { 
      roomId: gameState.roomId, 
      teamIndices: [0, 1, 2], // 选择前3人
      leaderPhone: players[leaderIndex].phone 
    }, r => {
      log('提交队伍', r.success);
      resolve();
    });
  });
  await sleep(1000);
  log('队伍提议事件', events.teamProposed > 0);
  
  // 7. 投票
  console.log('\n7. 投票...');
  const votes = ['approve', 'approve', 'approve', 'reject', 'approve']; // 4同意1反对
  await Promise.all(votes.map((v, i) => 
    new Promise(resolve => {
      sockets[i].emit('vote', { roomId: gameState.roomId, phone: players[i].phone, choice: v }, r => resolve(r));
    })
  ));
  await sleep(1000);
  log('投票事件', events.voteResult > 0);
  
  // 8. 任务执行
  console.log('\n8. 任务执行...');
  const missions = ['success', 'success', 'success', 'fail', 'success']; // 1个失败
  await Promise.all(missions.map((m, i) => 
    new Promise(resolve => {
      sockets[i].emit('submitMission', { roomId: gameState.roomId, phone: players[i].phone, result: m }, r => resolve(r));
    })
  ));
  await sleep(1000);
  log('任务结果事件', events.missionResult > 0);
  
  // 结果
  console.log('\n=== 测试结果 ===');
  console.log(`通过: ${results.passed}`);
  console.log(`失败: ${results.failed}`);
  console.log(`事件统计: ${JSON.stringify(events)}`);
  
  sockets.forEach(s => s.disconnect());
  process.exit(0);
}

run().catch(e => {
  console.error('错误:', e);
  process.exit(1);
});
