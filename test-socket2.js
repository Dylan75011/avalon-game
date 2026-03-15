const io = require('socket.io-client');

const socket = io('http://localhost:80', { timeout: 5000 });

socket.on('connect', () => {
  console.log('连接成功:', socket.id);
  
  socket.emit('register', { phone: '13900000111', username: '测试玩家' });
});

socket.on('registered', (data) => {
  console.log('注册成功:', data);
  socket.emit('createRoom', { playerCount: 5 });
});

socket.on('roomCreated', (data) => {
  console.log('房间创建:', data);
  process.exit(0);
});

socket.on('connect_error', (e) => {
  console.log('连接失败:', e.message);
  process.exit(1);
});

setTimeout(() => { console.log('超时'); process.exit(1); }, 5000);
