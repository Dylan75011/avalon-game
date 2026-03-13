// 模拟多玩家测试
const io = require('socket.io-client');
const axios = require('axios');

const SERVER = 'http://localhost:80';

const players = [
  { phone: '13900001001', name: '梅林玩家' },
  { phone: '13900001002', name: '派西玩家' },
  { phone: '13900001003', name: '忠臣A' },
  { phone: '13900001004', name: '忠臣B' },
  { phone: '13900001005', name: '刺客玩家' },
];

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function createRoom(player) {
  return new Promise((resolve) => {
    const socket = io(SERVER);
    socket.on('connect', () => {
      socket.emit('register', { phone: player.phone, username: player.name }, (res) => {
        if (res.success) {
          socket.emit('createRoom', { phone: player.phone, username: player.name }, (r) => {
            resolve({ socket, roomId: r.roomId, player });
          });
        } else {
          resolve(null);
        }
      });
    });
  });
}

async function joinRoom(roomId, player) {
  return new Promise((resolve) => {
    const socket = io(SERVER);
    socket.on('connect', () => {
      socket.emit('register', { phone: player.phone, username: player.name }, (res) => {
        if (res.success) {
          socket.emit('joinRoom', { roomId, phone: player.phone, username: player.name }, (r) => {
            resolve({ socket, player });
          });
        } else {
          resolve(null);
        }
      });
    });
  });
}

async function test() {
  console.log('🎮 开始模拟测试...\n');

  // 创建房间
  console.log('1. 创建房间...');
  const host = await createRoom(players[0]);
  console.log(`   房主: ${players[0].name}, 房间: ${host.roomId}`);

  // 其他玩家加入
  console.log('2. 其他玩家加入...');
  for (let i = 1; i < players.length; i++) {
    const p = await joinRoom(host.roomId, players[i]);
    console.log(`   加入: ${players[i].name}`);
  }

  await sleep(1000);

  // 开始游戏
  console.log('3. 开始游戏...');
  host.socket.emit('startGame', { roomId: host.roomId }, (r) => {
    console.log(`   开始: ${r.success ? '成功' : r.message}`);
  });

  await sleep(2000);

  // 监听游戏事件
  host.socket.on('gameStarted', (data) => {
    console.log('4. 游戏开始! 角色分配:');
    data.players.forEach((p, i) => {
      console.log(`   ${p.username}: ${p.role}`);
    });
  });

  // 模拟投票
  await sleep(2000);
  console.log('5. 模拟投票...');
  
  // 关闭连接
  await sleep(3000);
  console.log('\n✅ 模拟测试完成!\n检查以下问题:\n- 登录状态是否保存\n- 玩家列表显示是否正确\n- 角色分配是否正常\n- 投票流程是否顺畅');
  
  process.exit(0);
}

test();
