const io = require('socket.io-client');
const SERVER = 'http://47.81.9.246:80';

let passed = 0, failed = 0;

function log(name, ok, msg='') {
  if (ok) { passed++; console.log('✅ ' + name); }
  else { failed++; console.log('❌ ' + name + ' ' + msg); }
}

async function test() {
  console.log('=== 测试开始 ===\n');
  
  // 1. 注册新用户
  const s1 = io(SERVER);
  await new Promise(r => s1.on('connect', r));
  
  s1.emit('register', { phone: '13912345678', username: '测试A' }, (r) => {
    log('新用户注册', r.success && r.isNew === true);
  });
  await new Promise(r => setTimeout(r, 300));
  
  // 2. 创建房间
  let myRoomId = '';
  s1.emit('createRoom', { phone: '13912345678', username: '测试A', playerCount: 5 }, (r) => {
    log('创建房间', r.success);
    if (r.success) myRoomId = r.roomId;
    console.log('  房间号:', r.roomId);
  });
  await new Promise(r => setTimeout(r, 500));
  
  // 3. 另一个用户加入
  const s2 = io(SERVER);
  await new Promise(r => s2.on('connect', r));
  
  s2.emit('register', { phone: '13912345679', username: '测试B' }, (r) => {
    log('第二个用户注册', r.success);
  });
  await new Promise(r => setTimeout(r, 300));
  
  if (myRoomId) {
    s2.emit('joinRoom', { roomId: myRoomId, phone: '13912345679', username: '测试B' }, (r) => {
      log('加入房间', r.success, r.message || '');
    });
  }
  await new Promise(r => setTimeout(r, 500));
  
  // 4. 监听玩家加入
  s1.on('playerJoined', (data) => {
    log('收到玩家加入通知', data.players.length === 2);
  });
  await new Promise(r => setTimeout(r, 500));
  
  // 5. 排行榜
  s1.emit('getRanking', (list) => {
    log('排行榜查询', list.length > 0, list.length + '条');
  });
  await new Promise(r => setTimeout(r, 300));
  
  // 6. 用户信息
  s1.emit('getUser', { phone: '13912345678' }, (u) => {
    log('用户信息查询', !!u, '积分:' + (u?.points||0));
  });
  
  console.log('\n=== 结果: 通过' + passed + ' 失败' + failed + ' ===');
  
  setTimeout(() => { process.exit(0); }, 1000);
}

test();
