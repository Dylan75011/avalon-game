const io = require('socket.io-client');
const SERVER = 'http://47.81.9.246:80';

const players = [
  { phone: '13900001001', name: '玩家1' },
  { phone: '13900001002', name: '玩家2' },
  { phone: '13900001003', name: '玩家3' },
  { phone: '13900001004', name: '玩家4' },
  { phone: '13900001005', name: '玩家5' }
];

let results = { passed: 0, failed: 0 };
let events = { playerJoined: 0, gameStarted: 0, teamProposed: 0 };

function log(name, ok, msg = '') {
  if (ok) { results.passed++; console.log('✅ ' + name); }
  else { results.failed++; console.log('❌ ' + name + ' ' + msg); }
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function createSocketWithListeners() {
  return new Promise(resolve => {
    const s = io(SERVER, { timeout: 5000 });
    s.on('connect', () => {
      // 先设置监听器
      s.on('playerJoined', data => {
        events.playerJoined++;
        console.log('  收到 playerJoined, 当前:' + events.playerJoined);
      });
      s.on('gameStarted', data => {
        events.gameStarted++;
        console.log('  收到 gameStarted, 角色数:' + (data.roles ? Object.keys(data.roles).length : 0));
      });
      s.on('teamProposed', data => {
        events.teamProposed++;
        console.log('  收到 teamProposed');
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
  console.log('=== 5人同时在线测试 (修复版) ===\n');
  
  // 创建5个socket连接（带监听器）
  console.log('1. 创建5个连接...');
  const sockets = await Promise.all(players.map(() => createSocketWithListeners()));
  log('连接创建', sockets.length === 5);
  await sleep(500);
  
  // 注册5个用户
  console.log('\n2. 注册用户...');
  const regs = await Promise.all(players.map((p, i) => register(sockets[i], p.phone, p.name)));
  regs.forEach((r, i) => log(`玩家${i+1}注册`, r.success));
  await sleep(500);
  
  // 玩家1创建房间
  console.log('\n3. 玩家1创建房间...');
  let roomId = '';
  await new Promise(resolve => {
    sockets[0].emit('createRoom', { phone: players[0].phone, username: players[0].name, playerCount: 5 }, r => {
      log('创建5人房间', r.success, r.roomId || r.message);
      if (r.success) roomId = r.roomId;
      resolve();
    });
  });
  await sleep(500);
  
  // 其他玩家加入
  console.log('\n4. 其他玩家加入...');
  const joinResults = await Promise.all(players.slice(1).map((p, i) => 
    new Promise(resolve => {
      sockets[i+1].emit('joinRoom', { roomId, phone: p.phone, username: p.name }, r => resolve(r));
    })
  ));
  joinResults.forEach((r, i) => log(`玩家${i+2}加入`, r.success));
  await sleep(1500); // 等待事件传递
  
  log('玩家加入事件', events.playerJoined >= 4, `收到${events.playerJoined}次`);
  
  // 开始游戏
  console.log('\n5. 开始游戏...');
  await new Promise(resolve => {
    sockets[0].emit('startGame', { roomId }, r => {
      log('开始游戏', r.success, r.message || '');
      resolve();
    });
  });
  await sleep(1500); // 等待游戏开始事件
  
  log('游戏开始事件', events.gameStarted > 0);
  
  // 测试完成
  console.log('\n=== 测试结果 ===');
  console.log(`通过: ${results.passed}`);
  console.log(`失败: ${results.failed}`);
  console.log(`事件统计: playerJoined=${events.playerJoined}, gameStarted=${events.gameStarted}`);
  
  sockets.forEach(s => s.disconnect());
  process.exit(0);
}

run().catch(e => {
  console.error('错误:', e);
  process.exit(1);
});
