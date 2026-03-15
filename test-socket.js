const io = require('socket.io-client');

async function test() {
  console.log('=== Socket游戏流程测试 ===\n');
  
  const socket1 = io('http://47.81.9.246:80');
  const socket2 = io('http://47.81.9.246:80');
  
  let roomCode = '';
  
  // 等待连接
  await new Promise(r => setTimeout(r, 1000));
  
  // 玩家1注册
  socket1.emit('register', { phone: '13900000101', username: '测试1' });
  await new Promise(r => setTimeout(r, 500));
  
  // 玩家2注册
  socket2.emit('register', { phone: '13900000102', username: '测试2' });
  await new Promise(r => setTimeout(r, 500));
  
  // 玩家1创建房间
  socket1.emit('createRoom', { playerCount: 5 });
  await new Promise(r => setTimeout(r, 500));
  
  socket1.on('roomCreated', (data) => {
    roomCode = data.roomCode;
    console.log('房间创建:', roomCode);
    
    // 玩家2加入
    socket2.emit('joinRoom', { roomCode });
  });
  
  socket2.on('joinedRoom', (data) => {
    console.log('玩家2加入成功');
  });
  
  await new Promise(r => setTimeout(r, 1000));
  
  // 玩家1开始游戏
  socket1.emit('startGame');
  await new Promise(r => setTimeout(r, 1000));
  
  socket1.on('gameStarted', (data) => {
    console.log('游戏开始!', data.role ? '✅' : '❌');
  });
  
  await new Promise(r => setTimeout(r, 1000));
  
  console.log('\n=== 测试完成 ===');
  
  socket1.disconnect();
  socket2.disconnect();
  process.exit(0);
}

test().catch(e => {
  console.error('错误:', e.message);
  process.exit(1);
});
