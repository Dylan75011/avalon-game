// 完整测试脚本
const io = require('socket.io-client');
const SERVER = 'http://47.81.9.246:80';

const tests = {
  passed: 0,
  failed: 0,
  results: []
};

function log(name, passed, msg = '') {
  if (passed) {
    tests.passed++;
    tests.results.push(`✅ ${name}`);
  } else {
    tests.failed++;
    tests.results.push(`❌ ${name}: ${msg}`);
  }
  console.log((passed ? '✅' : '❌') + ' ' + name + (msg ? ' - ' + msg : ''));
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function createPlayer(phone, name) {
  return new Promise((resolve) => {
    const socket = io(SERVER, { timeout: 5000 });
    socket.on('connect', () => {
      socket.emit('register', { phone, username: name }, (res) => {
        resolve({ socket, phone, name, success: res.success, isNew: res.isNew });
      });
    });
    socket.on('connect_error', () => {
      resolve({ socket: null, phone, name, success: false, error: '连接失败' });
    });
  });
}

async function runTests() {
  console.log('='.repeat(50));
  console.log('阿瓦隆游戏 - 第1轮：核心功能测试');
  console.log('='.repeat(50));

  // 测试1: 新用户注册
  console.log('\n--- 1.1 用户注册登录 ---');
  const p1 = await createPlayer('13900001001', '测试玩家1');
  log('新用户注册', p1.success && p1.isNew === true);
  
  const p2 = await createPlayer('13900001001', '测试玩家1'); // 重复
  log('老用户登录', p2.success && p2.isNew === false);
  
  // 测试2: 创建房间
  console.log('\n--- 1.2 房间系统 ---');
  p1.socket.emit('createRoom', { phone: p1.phone, username: p1.name, playerCount: 5 }, (r) => {
    log('创建5人房间', r.success, r.roomId);
  });
  await sleep(500);
  
  const roomId = 'TEST01';
  p1.socket.emit('createRoom', { phone: p1.phone, username: p1.name, playerCount: 5 }, (r) => {
    log('创建房间返回房间号', !!r.roomId, r.roomId);
  });
  await sleep(500);

  // 测试3: 加入房间
  const p3 = await createPlayer('13900001003', '测试玩家3');
  p3.socket.emit('joinRoom', { roomId: roomId, phone: p3.phone, username: p3.name }, (r) => {
    log('加入房间', r.success);
  });
  await sleep(500);

  // 测试4: 房间状态
  p1.socket.on('playerJoined', (data) => {
    log('玩家加入通知', data.players && data.players.length > 0);
  });

  console.log('\n' + '='.repeat(50));
  console.log('第2轮：游戏流程测试');
  console.log('='.repeat(50));

  // 准备5个玩家
  const players = [];
  for (let i = 1; i <= 5; i++) {
    const p = await createPlayer('139000010' + i, '玩家' + i);
    players.push(p);
  }
  
  // 创建5人房间
  const room = 'TEST5P';
  players[0].socket.emit('createRoom', { phone: players[0].phone, username: players[0].name, playerCount: 5 }, (r) => {
    log('创建5人房间', r.success);
  });
  await sleep(500);

  // 其他玩家加入
  for (let i = 1; i < 5; i++) {
    players[i].socket.emit('joinRoom', { roomId: room, phone: players[i].phone, username: players[i].name }, (r) => {
      log(`玩家${i+1}加入`, r.success);
    });
    await sleep(200);
  }
  await sleep(1000);

  // 开始游戏
  players[0].socket.emit('startGame', { roomId: room }, (r) => {
    log('开始游戏', r.success, r.message || '');
  });

  // 监听游戏开始
  players[0].socket.on('gameStarted', (data) => {
    log('游戏开始事件', !!data.players);
    log('角色分配', !!data.roles);
  });
  await sleep(2000);

  console.log('\n' + '='.repeat(50));
  console.log('第3轮：体验测试');
  console.log('='.repeat(50));

  // 测试排行榜
  players[0].socket.emit('getRanking', (list) => {
    log('获取排行榜', list && list.length > 0, '共' + list.length + '条');
  });
  await sleep(500);

  // 测试获取用户信息
  players[0].socket.emit('getUser', { phone: players[0].phone }, (user) => {
    log('获取用户信息', !!user, '积分:' + (user?.points || 0));
  });
  await sleep(500);

  console.log('\n' + '='.repeat(50));
  console.log('测试结果汇总');
  console.log('='.repeat(50));
  console.log(`通过: ${tests.passed}`);
  console.log(`失败: ${tests.failed}`);
  console.log(tests.results.join('\n'));

  // 清理
  setTimeout(() => {
    players.forEach(p => p.socket?.disconnect());
    process.exit(0);
  }, 2000);
}

runTests().catch(e => {
  console.error('测试错误:', e);
  process.exit(1);
});
