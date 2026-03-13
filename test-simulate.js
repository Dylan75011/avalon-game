// 测试脚本 - 模拟5个玩家进行一局游戏
const io = require('socket.io-client');

const BASE_URL = 'http://localhost:3000';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 模拟玩家
class TestPlayer {
  constructor(name, phone) {
    this.name = name;
    this.phone = phone;
    this.socket = io(BASE_URL);
    this.connected = false;
    
    this.socket.on('connect', () => {
      this.connected = true;
      console.log(`[${this.name}] 已连接`);
      this.register();
    });
  }
  
  register() {
    this.socket.emit('register', { phone: this.phone, username: this.name }, (res) => {
      if (res.success) {
        console.log(`[${this.name}] 注册成功: ${res.user.username}`);
      }
    });
  }
  
  createRoom() {
    return new Promise(resolve => {
      this.socket.emit('createRoom', { phone: this.phone }, (res) => {
        if (res.success) {
          console.log(`[${this.name}] 创建房间: ${res.roomId}`);
        }
        resolve(res);
      });
    });
  }
  
  joinRoom(roomId) {
    return new Promise(resolve => {
      this.socket.emit('joinRoom', { roomId, phone: this.phone }, (res) => {
        console.log(`[${this.name}] 加入房间: ${res.success ? '成功' : '失败'}`);
        resolve(res);
      });
    });
  }
  
  startGame() {
    return new Promise(resolve => {
      this.socket.emit('startGame', { roomId: this.roomId }, (res) => {
        console.log(`[${this.name}] 开始游戏: ${res.success ? '成功' : res.message}`);
        resolve(res);
      });
    });
  }
  
  onGameStarted(callback) {
    this.socket.on('gameStarted', callback);
  }
  
  onTeamProposed(callback) {
    this.socket.on('teamProposed', callback);
  }
  
  onVoteResult(callback) {
    this.socket.on('voteResult', callback);
  }
  
  onMissionResult(callback) {
    this.socket.on('missionResult', callback);
  }
  
  submitTeam(teamIndices) {
    this.socket.emit('submitTeam', {
      roomId: this.roomId,
      teamIndices,
      leaderPhone: this.phone
    }, (res) => {
      console.log(`[${this.name}] 提交团队: ${res.success}`);
    });
  }
  
  vote(choice) {
    this.socket.emit('vote', {
      roomId: this.roomId,
      phone: this.phone,
      vote: choice
    }, (res) => {
      console.log(`[${this.name}] 投票: ${choice}`);
    });
  }
  
  submitMission(result) {
    this.socket.emit('submitMission', {
      roomId: this.roomId,
      phone: this.phone,
      result
    }, (res) => {
      console.log(`[${this.name}] 任务结果: ${result}`);
    });
  }
}

async function testGame() {
  console.log('🚀 开始阿瓦隆测试...\n');
  
  // 创建5个测试玩家
  const players = [
    new TestPlayer('玩家1', '13800000001'),
    new TestPlayer('玩家2', '13800000002'),
    new TestPlayer('玩家3', '13800000003'),
    new TestPlayer('玩家4', '13800000004'),
    new TestPlayer('玩家5', '13800000005'),
  ];
  
  // 等待连接
  await sleep(2000);
  
  // 玩家1创建房间
  const room = await players[0].createRoom();
  const roomId = room.roomId;
  
  // 其他玩家加入
  for (let i = 1; i < players.length; i++) {
    await players[i].joinRoom(roomId);
    await sleep(500);
  }
  
  // 设置房间ID
  players.forEach(p => p.roomId = roomId);
  
  await sleep(1000);
  
  // 玩家1开始游戏
  console.log('\n🎮 开始游戏...\n');
  await players[0].startGame();
  
  await sleep(2000);
  
  // 监听游戏开始，获取角色
  players[0].onGameStarted((data) => {
    console.log('\n📋 游戏开始! 角色分配:');
    data.players.forEach((p, i) => {
      const roleNames = {
        'merlin': '梅林', 'percival': '派西维尔', 'loyalist': '忠臣',
        'assassin': '刺客', 'minion': '爪牙', 'oberon': '奥伯伦'
      };
      console.log(`  玩家${i+1}: ${roleNames[p.role] || p.role}`);
    });
  });
  
  await sleep(3000);
  
  // 模拟第1轮
  console.log('\n--- 第1轮 ---');
  // 假设玩家1是队长，提交团队（玩家1,2）
  players[0].submitTeam([0, 1]);
  
  await sleep(1000);
  
  // 所有玩家投票同意
  players.forEach(p => p.vote('approve'));
  
  await sleep(2000);
  
  // 执行任务（都选成功）
  players[0].onMissionResult((data) => {
    console.log(`\n任务结果: ${data.success ? '✅ 成功' : '❌ 失败'}`);
  });
  
  players.forEach(p => p.submitMission('success'));
  
  await sleep(3000);
  
  // 第2轮
  console.log('\n--- 第2轮 ---');
  players[1].submitTeam([1, 2, 3]); // 玩家2当队长
  
  await sleep(1000);
  players.forEach(p => p.vote('approve'));
  
  await sleep(2000);
  players.forEach(p => p.submitMission('success'));
  
  await sleep(3000);
  
  // 第3轮
  console.log('\n--- 第3轮 ---');
  players[2].submitTeam([0, 2, 4]);
  
  await sleep(1000);
  players.forEach(p => p.vote('approve'));
  
  await sleep(2000);
  players.forEach(p => p.submitMission('success'));
  
  await sleep(3000);
  
  // 第4轮
  console.log('\n--- 第4轮 ---');
  players[3].submitTeam([0, 1, 2, 3]);
  
  await sleep(1000);
  players.forEach(p => p.vote('approve'));
  
  await sleep(2000);
  // 这一轮选一个失败
  players[0].submitMission('success');
  players[1].submitMission('fail'); // 坏人搞破坏
  players[2].submitMission('success');
  players[3].submitMission('success');
  
  await sleep(3000);
  
  // 第5轮
  console.log('\n--- 第5轮 ---');
  players[4].submitTeam([0, 1, 2, 3, 4]);
  
  await sleep(1000);
  players.forEach(p => p.vote('reject')); // 拒绝
  
  await sleep(2000);
  
  // 重新提交
  players[4].submitTeam([0, 1, 2]);
  
  await sleep(1000);
  players.forEach(p => p.vote('approve'));
  
  await sleep(2000);
  players.forEach(p => p.submitMission('success'));
  
  await sleep(3000);
  
  console.log('\n✅ 测试完成!');
  process.exit(0);
}

testGame().catch(console.error);
