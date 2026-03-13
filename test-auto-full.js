const io = require('socket.io-client');
const SERVER = 'http://localhost:80';

const players = [
  { phone: '13900001001', name: '玩家1' },
  { phone: '13900001002', name: '玩家2' },
  { phone: '13900001003', name: '玩家3' },
  { phone: '13900001004', name: '玩家4' },
  { phone: '13900001005', name: '玩家5' }
];

let sockets = [];
let roomId = '';
let roles = {};
let gameEvents = [];

function log(msg) {
  console.log(msg);
  gameEvents.push(msg);
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log('=== 完整游戏流程测试 ===\n');
  
  // 1. 连接并注册
  log('【1】连接服务器...');
  for (let i = 0; i < 5; i++) {
    sockets[i] = io(SERVER, { timeout: 5000 });
    await new Promise(r => sockets[i].on('connect', r));
    sockets[i].emit('register', { phone: players[i].phone, username: players[i].name }, (res) => {
      log(`  ${players[i].name} 注册: ${res.success ? '✅' : '❌'}`);
    });
  }
  await sleep(500);
  
  // 2. 玩家1创建房间
  log('\n【2】创建房间...');
  sockets[0].emit('createRoom', { phone: players[0].phone, username: players[0].name, playerCount: 5 }, (res) => {
    if (res.success) {
      roomId = res.roomId;
      log(`  房间创建成功: ${roomId} ✅`);
    } else {
      log(`  创建失败: ${res.message} ❌`);
    }
  });
  await sleep(500);
  
  // 3. 其他玩家加入
  log('\n【3】玩家加入...');
  for (let i = 1; i < 5; i++) {
    sockets[i].emit('joinRoom', { roomId, phone: players[i].phone, username: players[i].name }, (res) => {
      log(`  ${players[i].name} 加入: ${res.success ? '✅' : '❌'}`);
    });
  }
  await sleep(1000);
  
  // 4. 开始游戏
  log('\n【4】开始游戏...');
  sockets[0].emit('startGame', { roomId }, (res) => {
    log(`  开始游戏: ${res.success ? '✅' : '❌'} ${res.message || ''}`);
  });
  await sleep(1500);
  
  // 5. 监听游戏开始事件
  sockets.forEach((s, i) => {
    s.on('gameStarted', (data) => {
      roles[players[i].name] = data.myRole;
      log(`  ${players[i].name} 角色: ${data.myRole} ✅`);
    });
  });
  await sleep(1000);
  
  // 6. 队长组队 (玩家1是队长)
  log('\n【5】队长组队...');
  sockets[0].emit('submitTeam', { roomId, teamIndices: [0, 1, 2], leaderPhone: players[0].phone }, (res) => {
    log(`  提交队伍: ${res.success ? '✅' : '❌'}`);
  });
  await sleep(1000);
  
  // 7. 投票
  log('\n【6】投票...');
  const votes = ['approve', 'approve', 'approve', 'approve', 'approve']; // 全部同意
  for (let i = 0; i < 5; i++) {
    sockets[i].emit('vote', { roomId, phone: players[i].phone, choice: votes[i] }, () => {
      log(`  ${players[i].name} 投票: ${votes[i]} ✅`);
    });
  }
  await sleep(1000);
  
  // 8. 任务执行
  log('\n【7】任务执行...');
  const missions = ['success', 'success', 'success', 'fail', 'success']; // 1个失败
  for (let i = 0; i < 5; i++) {
    sockets[i].emit('submitMission', { roomId, phone: players[i].phone, result: missions[i] }, () => {
      log(`  ${players[i].name} 任务: ${missions[i]} ✅`);
    });
  }
  await sleep(1500);
  
  // 结果
  log('\n=== 测试结果 ===');
  log(`房间: ${roomId}`);
  log('角色分配: ' + JSON.stringify(roles));
  log('\n测试完成! 🎉');
  
  sockets.forEach(s => s.disconnect());
  process.exit(0);
}

run().catch(e => {
  console.error('错误:', e);
  process.exit(1);
});
