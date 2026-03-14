// Avalon Game Client

let socket = io();
let currentUser = null;
let currentRoom = null;
let selectedTeam = [];
let selectedPlayerCount = 5;
let gamePlayers = [];
let myRole = null;
let currentLeaderPhone = null;
let approvedTeamPhones = [];
let currentRound = 0;
let currentPhase = 'waiting';
let requiredTeamSize = 0;

setIdentityButtonsVisible(false);

// 本地存储
function checkLoginState() {
  const savedUser = localStorage.getItem("avalon_user");
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      document.getElementById("phone").value = currentUser.phone;
      showScreen('lobby');
      updateLobbyStats();
    } catch(e) {
      localStorage.removeItem("avalon_user");
    }
  }
}

function saveLoginState(user) {
  currentUser = user;
  localStorage.setItem("avalon_user", JSON.stringify(user));
}

function setIdentityButtonsVisible(visible) {
  document.querySelectorAll('.identity-btn').forEach((button) => {
    button.classList.toggle('hidden', !visible);
  });
}

function hideGameActions() {
  const ids = ['leaderActions', 'voteActions', 'missionActions'];
  ids.forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.classList.add('hidden');
  });
}

function resetGameViewState() {
  selectedTeam = [];
  approvedTeamPhones = [];
  currentLeaderPhone = null;
  currentRound = 0;
  currentPhase = 'waiting';
  requiredTeamSize = 0;
  myRole = null;
  hideGameActions();
  const resultDiv = document.getElementById('resultDisplay');
  if (resultDiv) {
    resultDiv.classList.add('hidden');
    resultDiv.classList.remove('parchment-card');
  }
  const roundLabel = document.getElementById('currentRound');
  if (roundLabel) roundLabel.textContent = '';
}

function updateRoundLabel() {
  const roundLabel = document.getElementById('currentRound');
  if (!roundLabel || !currentRound) return;
  roundLabel.textContent = `第 ${currentRound} 轮`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getMissionTeamSize(playerCount, round) {
  const sizes = {
    5: [2, 3, 2, 3, 3],
    6: [2, 3, 4, 3, 4],
    7: [2, 3, 3, 4, 4],
    8: [3, 4, 4, 5, 5],
    9: [3, 4, 4, 5, 5],
    10: [3, 4, 4, 5, 5]
  };
  const rounds = sizes[playerCount] || sizes[5];
  return rounds[Math.max(0, round - 1)] || rounds[0];
}

// 英雄头像生成 - 史诗卡牌风格
function generateAvatar(name, phone) {
  const colors = ['#c9a227', '#8b4513', '#2e8b57', '#4169e1', '#8b008b', '#cd5c5c', '#20b2aa', '#ff8c00', '#4682b4', '#9932cc'];
  const hash = phone.split('').reduce((a,b) => ((a<<5)-a)+b.charCodeAt(0),0);
  const color = colors[Math.abs(hash) % colors.length];
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  
  // 创建一个带有金属边框和纹理感的方形头像
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
      <defs>
        <linearGradient id="g_${phone}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
          <stop offset="100%" style="stop-color:#1a1612;stop-opacity:1" />
        </linearGradient>
        <filter id="f_${phone}" x="0" y="0">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
          <feOffset dx="1" dy="1" />
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect width="80" height="80" fill="#0f0c09" />
      <rect x="4" y="4" width="72" height="72" fill="url(#g_${phone})" rx="2" />
      <rect x="4" y="4" width="72" height="72" fill="none" stroke="#63472b" stroke-width="3" rx="2" opacity="0.6" />
      <text x="40" y="52" font-size="36" fill="#f9e076" text-anchor="middle" font-family="serif" font-weight="bold" filter="url(#f_${phone})">${initial}</text>
      <path d="M4 4 L20 4 L4 20 Z" fill="#63472b" opacity="0.8" />
      <path d="M76 76 L60 76 L76 60 Z" fill="#63472b" opacity="0.8" />
    </svg>`;
  
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

// 注册/登录
function register() {
  const phone = document.getElementById("phone").value.trim();
  const username = document.getElementById("username").value.trim();
  
  if (!phone || phone.length < 11) {
    toast("请输入正确的手机号", "warning");
    return;
  }
  
  showLoading("登录中...");
  
  socket.emit('register', { phone, username }, (response) => {
    hideLoading();
    
    if (response.success) {
      currentUser = { 
        phone: response.user.phone, 
        username: response.user.username,
        avatar: generateAvatar(response.user.username, response.user.phone),
        total_points: response.user.total_points || 0
      };
      saveLoginState(currentUser);
      
      if (response.isNew === false) {
        toast("欢迎回来，" + response.user.username, "success");
      } else {
        toast("注册成功！欢迎 " + response.user.username, "success");
      }
      
      showScreen('lobby');
      updateLobbyStats();
    } else {
      toast(response.message || "登录失败", "error");
    }
  });
}

// Socket
socket.on("connect", function() { console.log("Connected"); });
socket.on("connect_error", function(err) { toast("连接失败，请检查网络", "error"); });

// 断线重连
socket.on('disconnect', (reason) => {
  toast("连接断开，正在重连...", "warning");
});
socket.on('reconnect', () => {
  toast("已重新连接", "success");
  if (currentRoom && currentUser) {
    socket.emit('joinRoom', { roomId: currentRoom, phone: currentUser.phone, username: currentUser.username }, (res) => {
      if (res.success) {
        gamePlayers = res.players || gamePlayers;
        selectedPlayerCount = res.requiredPlayers || selectedPlayerCount;
        if (res.gameState) {
          restoreGameState(res.gameState);
        } else {
          updateRoomUI();
        }
        toast("已回到房间", "success");
      }
    });
  }
});

// UI提示
function showLoading(msg) {
  const div = document.createElement("div");
  div.id = "loadingToast";
  div.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.95);color:#c9a227;padding:20px 40px;border-radius:8px;font-size:16px;z-index:9999;";
  div.textContent = msg || "加载中...";
  document.body.appendChild(div);
}

function hideLoading() {
  const div = document.getElementById("loadingToast");
  if (div) div.remove();
}

function toast(msg, type) {
  type = type || "info";
  const colors = { success: "#228b22", error: "#8b0000", info: "#4a3f35", warning: "#8b5a2b" };
  const div = document.createElement("div");
  div.style.cssText = "position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:"+(colors[type]||colors.info)+";color:#fff;padding:12px 24px;border-radius:25px;font-size:14px;z-index:9999;animation:fadeInUp 0.3s ease;box-shadow:0 4px 12px rgba(0,0,0,0.3);";
  div.textContent = msg;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

function updatePhase(name, desc) {
  const el = document.getElementById("turnIndicator");
  if (!el) return;
  el.style.display = "block";
  const nameEl = el.querySelector(".phase-name");
  const descEl = el.querySelector(".phase-desc");
  if (nameEl) nameEl.textContent = name;
  if (descEl) descEl.textContent = desc;
}

function showScreen(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(screen + 'Screen').classList.remove('hidden');
}

function updateLobbyStats() {
  document.getElementById("welcomeUser").textContent = currentUser.username;
  socket.emit('getUser', { phone: currentUser.phone }, (user) => {
    if (user) {
      document.getElementById("totalPoints").textContent = user.total_points || 0;
      document.getElementById("gamesPlayed").textContent = user.games_played || 0;
      document.getElementById("gamesWon").textContent = user.games_won || 0;
    }
  });
}

function createRoom() {
  showLoading("创建房间...");
  socket.emit('createRoom', { phone: currentUser.phone, username: currentUser.username, playerCount: selectedPlayerCount }, (response) => {
    hideLoading();
    if (response.success) {
      currentRoom = response.roomId;
      selectedPlayerCount = response.requiredPlayers || selectedPlayerCount;
      gamePlayers = response.players || [];
      showScreen('room');
      document.getElementById("inviteCode").textContent = currentRoom;
      updateRoomUI();
      toast("房间创建成功", "success");
    } else {
      alert(response.message || "创建失败");
    }
  });
}

function joinRoom() {
  const code = document.getElementById("joinCode").value.trim().toUpperCase();
  if (!code || code.length !== 6) {
    toast("请输入6位邀请码", "warning");
    return;
  }
  showLoading("加入房间...");
  socket.emit('joinRoom', { roomId: code, phone: currentUser.phone, username: currentUser.username }, (response) => {
    hideLoading();
    if (response.success) {
      currentRoom = code;
      selectedPlayerCount = response.requiredPlayers || selectedPlayerCount;
      gamePlayers = response.players || [];
      showScreen('room');
      document.getElementById("inviteCode").textContent = currentRoom;
      updateRoomUI();
      if (response.gameState) {
        restoreGameState(response.gameState);
      }
      toast("加入成功", "success");
    } else {
      alert(response.message || "加入失败");
    }
  });
}

function selectPlayerCount(count) {
  selectedPlayerCount = count;
  updateTeamSizeHint();
  document.querySelectorAll('.count-btn').forEach(btn => {
    btn.classList.toggle('selected', parseInt(btn.dataset.count) === count);
  });
  document.getElementById("waitingHint").textContent = "等待玩家加入... (" + count + "人局)";
  document.getElementById("maxPlayers").textContent = count;
  updateStartButton();
}

function updateStartButton() {
  const btn = document.getElementById("startBtn");
  if (!btn) return;
  const me = gamePlayers.find(player => player.phone === currentUser?.phone);
  const needed = selectedPlayerCount - (gamePlayers.length || 0);
  if (!me || !me.isLeader) {
    btn.textContent = "等待房主开始";
    btn.disabled = true;
  } else if (needed > 0) {
    btn.textContent = "等待 " + needed + " 人";
    btn.disabled = true;
  } else {
    btn.textContent = "⚔️ 开始战役";
    btn.disabled = false;
  }
}

function startGame() {
  socket.emit('startGame', { roomId: currentRoom }, (response) => {
    if (!response.success) toast(response.message, "error");
  });
}

function leaveRoom() {
  socket.emit('leaveRoom', { roomId: currentRoom, phone: currentUser.phone }, (response) => {
    if (response && response.success === false) {
      toast(response.message || "无法离开房间", "error");
      return;
    }
    currentRoom = null;
    setIdentityButtonsVisible(false);
    gamePlayers = [];
    resetGameViewState();
    showScreen('lobby');
  });
}

function copyInviteCode() {
  const code = currentRoom || '';
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(code).then(() => toast("邀请码已复制", "success")).catch(() => fallbackCopy(code));
  } else {
    fallbackCopy(code);
  }
}

function fallbackCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    toast("邀请码已复制", "success");
  } catch(e) { toast("复制失败: " + text, "info"); }
  document.body.removeChild(textarea);
}

// Socket事件
socket.on('playerJoined', (data) => {
  gamePlayers = data.players;
  updateRoomUI();
});

socket.on('playerLeft', (data) => {
  gamePlayers = data.players;
  updateRoomUI();
  if (data.newHost === currentUser.phone) toast("你已成为新房主", "success");
  updateStartButton();
});

socket.on('gameStarted', (data) => {
  restoreGameState(data);
  showRoleStart(data);
  toast("游戏开始！你的角色: " + data.myRole, "success");
});

function restoreGameState(data) {
  hideGameActions();
  gamePlayers = data.players || [];
  myRole = data.myRole || myRole;
  currentLeaderPhone = data.leaderPhone || null;
  approvedTeamPhones = data.approvedTeamPhones || [];
  currentRound = data.round || currentRound || 1;
  currentPhase = data.phase || currentPhase;
  requiredTeamSize = getMissionTeamSize(gamePlayers.length, currentRound);
  selectedTeam = [];

  showScreen('game');
  document.getElementById("myRole").textContent = myRole || '';
  setIdentityButtonsVisible(Boolean(myRole));
  updateRoundLabel();
  updatePlayersGrid();
  updateGameProgress(currentRound, data.missionHistory || []);
  updatePhase(getPhaseTitle(data.phase), getPhaseDescription(data));

  if (data.phase === 'team_building' && data.leaderPhone === currentUser.phone) {
    showLeaderActions();
  } else if (data.phase === 'voting') {
    showVoteActions();
  } else if (data.phase === 'mission') {
    showMissionActions();
  } else if (data.phase === 'assassination') {
    renderAssassinationPanel(data.assassinationTargets || []);
  }
}

function getPhaseTitle(phase) {
  const titles = {
    team_building: "⚔️ 组队阶段",
    voting: "🗳️ 投票阶段",
    mission: "⚔️ 任务阶段",
    assassination: "🗡️ 刺杀阶段"
  };
  return titles[phase] || "🎮 游戏进行中";
}

function getPhaseDescription(data) {
  if (data.phase === 'team_building') {
    return data.leaderPhone === currentUser.phone
      ? `轮到你组队，本轮需要选择 ${requiredTeamSize} 人`
      : `等待队长组队，本轮需要 ${requiredTeamSize} 人`;
  }
  if (data.phase === 'voting') {
    return "全员投票中，请确认队伍是否可信";
  }
  if (data.phase === 'mission') {
    return approvedTeamPhones.includes(currentUser.phone)
      ? "你在任务队伍中，请私下提交结果"
      : "任务执行中，等待队员匿名提交";
  }
  if (data.phase === 'assassination') {
    return myRole === 'assassin' ? "请选择你认为是梅林的玩家" : "等待刺客做出最终选择";
  }
  return "你的角色: " + (data.myRole || myRole || '');
}

function showRoleStart(data) {
  showRoleInfo(data.myRole, data.mySees || []);
}

// 显示角色信息和可见玩家
function showRoleInfo(role, sees) {
  const roleNames = {
    'merlin': '🧙 梅林',
    'percival': '🛡️ 派西维尔',
    'loyalist': '👼 忠臣',
    'assassin': '🗡️ 刺客',
    'minion': '👿 爪牙',
    'oberon': '👺 奥伯伦'
  };
  
  const roleDesc = {
    'merlin': '预言者：你能识别已知坏人，请谨慎引导队伍。',
    'percival': '守护者：你会看到梅林候选人，请保护真正的梅林。',
    'loyalist': '亚瑟忠臣：努力找出坏人，确保任务成功。',
    'assassin': '刺客：你可以最后指认梅林，反败为胜。',
    'minion': '爪牙：你知道其他已知坏人，负责误导好人。',
    'oberon': '局外人：你是坏人，但并不认识队友。'
  };
  
  const avatarUrl = ROLE_AVATARS[role] || '';
  
  // 创建沉浸式信息面板
  let info = `
    <div class="role-reveal" style="text-align:center; padding:10px 0;">
      ${avatarUrl ? `<img src="${avatarUrl}" style="width:140px;height:140px;border:3px solid var(--gold);margin-bottom:15px;box-shadow:0 0 20px rgba(201,162,39,0.5);border-radius:4px;">` : ''}
      <p style="font-size:1.1rem; color:var(--text-main);"><strong>${roleDesc[role] || ''}</strong></p>
    </div>
  `;
  
  if (sees && sees.length > 0) {
    info += '<div class="ally-list" style="margin-top:10px;"><h4>你的视野:</h4>';
    if (role === 'percival') {
      info += '<p>' + sees.map(s => `<span>${escapeHtml(s.username)}</span>(?)`).join(', ') + '</p>';
    } else {
      info += '<p>' + sees.map(s => `<span style="color:${s.type === 'evil' ? '#ff6b6b' : '#90EE90'}">${escapeHtml(s.username)}</span>`).join(', ') + '</p>';
    }
    info += '</div>';
  } else if (role === 'loyalist' || role === 'oberon') {
    info += '<p style="margin-top:10px;"><i>你没有特殊视角，通过言谈进行推理吧。</i></p>';
  }
  
  // 在结果面板显示角色信息
  const resultDiv = document.getElementById('resultDisplay');
  resultDiv.classList.remove('hidden');
  resultDiv.classList.add('parchment-card'); // 切换到羊皮纸模式
  
  document.getElementById('resultTitle').textContent = roleNames[role] || role;
  document.getElementById('resultMessage').innerHTML = info;
  
  // 亮相时间延长至 8 秒
  setTimeout(() => {
    resultDiv.classList.add('hidden');
    resultDiv.classList.remove('parchment-card');
  }, 8000);
}

socket.on('teamProposed', (data) => {
  currentPhase = 'voting';
  requiredTeamSize = data.requiredTeamSize || requiredTeamSize;
  updatePhase("🗳️ 投票阶段", "队长已提交队伍");
  approvedTeamPhones = [];
  const teamNames = (data.teamIndices || []).map(i => gamePlayers[i]?.username).join(', ');
  toast("队伍: " + teamNames, "info");
  showVoteActions();
});

socket.on('voteResult', (data) => {
  const result = data.isApproved ? "✅ 通过" : "❌ 否决";
  
  // 显示投票详情
  let voteDetails = [];
  for (let [phone, choice] of Object.entries(data.votes)) {
    const player = gamePlayers.find(p => p.phone === phone);
    const name = player ? player.username : "未知";
    voteDetails.push(name + ": " + (choice === "approve" ? "✓" : "✗"));
  }
  
  // 显示结果面板
  const resultDiv = document.getElementById('resultDisplay');
  resultDiv.classList.remove('hidden');
  document.getElementById('resultTitle').textContent = "投票结果: " + result;
  document.getElementById('resultMessage').textContent = voteDetails.join('\n');
  
  // 3秒后自动隐藏
  setTimeout(() => {
    if (data.isApproved) {
      currentPhase = 'mission';
      updatePhase("⚔️ 任务阶段", "执行任务...");
      approvedTeamPhones = data.approvedTeamPhones || [];
      showMissionActions();
      resultDiv.classList.add('hidden');
    } else {
      currentPhase = 'team_building';
      updatePhase("🔄 重新组队", "队伍被否决，等待下一轮");
    }
  }, 3000);
});

socket.on('missionResult', (data) => {
  const result = data.success ? "✅ 成功" : "❌ 失败";
  
  currentRound = data.round || currentRound;
  updateRoundLabel();
  // 显示结果面板
  const resultDiv = document.getElementById('resultDisplay');
  resultDiv.classList.remove('hidden');
  document.getElementById('resultTitle').textContent = "任务" + result;
  
  // 显示任务详情
  document.getElementById('resultMessage').textContent =
    `本次任务共有 ${data.teamSize || approvedTeamPhones.length || 0} 名队员参与。\n` +
    `失败票: ${data.fails || 0}\n\n` +
    `任务结果匿名结算，不公开每位队员的选择。`;
  
  setTimeout(() => {
    resultDiv.classList.add('hidden');
    // 如果是下一轮，队长可以开始组队
  }, 3000);
  
  updateGameProgress(data.round, data.missionHistory || []);
  updateLobbyStats();
});

socket.on('assassinationPhase', (data) => {
  currentPhase = 'assassination';
  hideGameActions();
  updatePhase("🗡️ 刺杀阶段", "刺客选择梅林");
  currentLeaderPhone = null;
  renderAssassinationPanel(data.targets || []);
  toast("好人已完成3轮任务，刺客选择梅林！", "error");
});

socket.on('assassinationResult', (data) => {
  toast(data.success ? "刺杀成功！" : "刺杀失败！", data.success ? "error" : "success");
});

socket.on('gameEnded', (data) => {
  const msg = data.winner === 'good' ? "✅ 好人胜利！" : "💀 坏人胜利！";
  toast(msg, data.winner === 'good' ? "success" : "error");
  
  // 隐藏所有操作按钮
  document.getElementById("leaderActions").classList.add('hidden');
  document.getElementById("voteActions").classList.add('hidden');
  document.getElementById("missionActions").classList.add('hidden');
  document.getElementById("turnIndicator").style.display = 'none';
  
  // 显示游戏结束面板
  const resultDiv = document.getElementById("resultDisplay");
  resultDiv.classList.remove('hidden');
  document.getElementById("resultTitle").textContent = msg;
  document.getElementById("resultTitle").style.fontSize = "1.5rem";
  document.getElementById("resultTitle").style.padding = "20px";
  document.getElementById("resultTitle").style.background = data.winner === 'good' ? "var(--green)" : "var(--red)";
  document.getElementById("resultMessage").textContent = data.reason + "\n\n游戏已结束";
  
  // 添加返回大厅按钮
  const backBtn = document.createElement('button');
  backBtn.textContent = "🏠 返回大厅";
  backBtn.style.marginTop = "15px";
  backBtn.onclick = function() {
    showScreen('lobby');
    currentRoom = null;
    setIdentityButtonsVisible(false);
    gamePlayers = [];
    resetGameViewState();
    updateLobbyStats();
  };
  resultDiv.querySelector('#resultMessage').appendChild(document.createElement('br'));
  resultDiv.querySelector('#resultMessage').appendChild(backBtn);
  
  // 不自动返回，等待玩家点击
});

socket.on('nextRound', (data) => {
  currentRound = data.round || currentRound + 1;
  currentPhase = 'team_building';
  requiredTeamSize = getMissionTeamSize(gamePlayers.length, currentRound);
  currentLeaderPhone = data.leaderPhone || null;
  approvedTeamPhones = [];
  selectedTeam = [];
  hideGameActions();
  updateRoundLabel();
  updateGameProgress(currentRound);
  updatePhase("第 " + data.round + " 轮", "队长: " + (data.leaderUsername || ''));
  if (data.leaderPhone === currentUser.phone) showLeaderActions();
});

// UI更新
function updateRoomUI() {
  const list = document.getElementById("players");
  list.innerHTML = '';
  gamePlayers.forEach(p => {
    const li = document.createElement("li");
    li.className = "player-waiting-card";
    li.innerHTML = '<div class="player-avatar">'+(p.avatar || '👤')+'</div><div class="player-info"><div class="player-name">'+escapeHtml(p.username)+'</div><div class="player-status '+(p.isLeader?'host':'')+'">'+(p.isLeader?'👑 房主':'玩家')+'</div></div>';
    list.appendChild(li);
  });
  document.getElementById("playerCount").textContent = gamePlayers.length;
  updateStartButton();
}

// 角色头像映射
const ROLE_AVATARS = {
  'merlin': '/avatars/merlin.png',
  'percival': '/avatars/percival.png',
  'loyalist': '/avatars/loyal_servant.png',
  'assassin': '/avatars/assassin.png',
  'minion': '/avatars/morgana.png',
  'oberon': '/avatars/oberon.png',
  'mordred': '/avatars/mordred.png'
};

function updatePlayersGrid() {
  const grid = document.getElementById("playersGrid");
  if (!grid) return;
  grid.innerHTML = '';
  
  gamePlayers.forEach((p, i) => {
    const card = document.createElement("div");
    const isMe = p.phone === currentUser.phone;
    const isLeader = p.phone === currentLeaderPhone;
    const inTeam = selectedTeam.includes(i) || (approvedTeamPhones && approvedTeamPhones.includes(p.phone));
    
    card.className = "player-card";
    if (isLeader) card.classList.add('is-leader');
    if (inTeam) card.classList.add('in-team');
    if (approvedTeamPhones && approvedTeamPhones.includes(p.phone)) card.classList.add('on-mission');
    
    card.id = "player-" + i;
    
    // 如果是我自己且已有角色，显示立绘头像
    let avatarHtml = p.avatar || '👤';
    if (isMe && myRole && ROLE_AVATARS[myRole]) {
      avatarHtml = `<img src="${ROLE_AVATARS[myRole]}" style="width:100%;height:100%;object-fit:cover;border-radius:2px;">`;
    }

    card.innerHTML = `
      <div class="player-card-avatar">${avatarHtml}</div>
      <div class="name">${escapeHtml(p.username)} ${isMe ? '(你)' : ''}</div>
      <div class="status">${isLeader ? '队长' : ''}</div>
    `;
    
    // 如果是组队阶段且我是队长，允许点击
    if (currentLeaderPhone === currentUser.phone) {
      card.onclick = () => toggleTeamMember(card, i);
    }
    
    grid.appendChild(card);
  });
}

function updateGameProgress(round, missionHistory = []) {
  const progress = document.getElementById("gameProgress");
  if (!progress) return;
  progress.innerHTML = '';
  
  for (let i = 1; i <= 5; i++) {
    const step = document.createElement("div");
    step.className = "progress-step";
    
    const result = missionHistory[i - 1]; // true = success, false = fail, undefined = not yet played
    
    if (result === true) {
      step.textContent = "⚔️";
      step.classList.add("success");
      step.title = "任务成功";
    } else if (result === false) {
      step.textContent = "💀";
      step.classList.add("fail");
      step.title = "任务失败";
    } else if (i === round) {
      step.textContent = i;
      step.classList.add("current");
      step.title = "当前轮次";
    } else {
      step.textContent = i;
      step.style.opacity = "0.5";
    }
    progress.appendChild(step);
  }
}

function showLeaderActions() {
  selectedTeam = [];
  document.getElementById("leaderActions").classList.remove("hidden");
  document.getElementById("voteActions").classList.add("hidden");
  document.getElementById("missionActions").classList.add("hidden");
  updateLeaderSelectionHint();
  updatePhase("⚔️ 组队阶段", `选择 ${requiredTeamSize} 名任务成员`);
  document.querySelectorAll('.player-card').forEach((card, i) => {
    card.onclick = () => {
      toggleTeamMember(card, i);
    };
  });
}

function showVoteActions() {
  document.getElementById("leaderActions").classList.add("hidden");
  document.getElementById("voteActions").classList.remove("hidden");
  document.getElementById("missionActions").classList.add("hidden");
}

function showMissionActions() {
  document.getElementById("leaderActions").classList.add("hidden");
  document.getElementById("voteActions").classList.add("hidden");
  if (!approvedTeamPhones.includes(currentUser.phone)) {
    document.getElementById("missionActions").classList.add("hidden");
    return;
  }
  document.getElementById("missionActions").classList.remove("hidden");
  const desc = document.querySelector('#missionActions p');
  if (desc) {
    desc.textContent = ['assassin', 'minion', 'oberon'].includes(myRole)
      ? '请选择任务结果。请勿让其他人看到你的操作。'
      : '你是好人，只能提交成功。请私下点击提交。';
  }
  const failButton = document.querySelector('#missionActions .reject');
  if (failButton) {
    const canFail = ['assassin', 'minion', 'oberon'].includes(myRole);
    failButton.style.display = canFail ? '' : 'none';
  }
}

function submitTeam() {
  if (selectedTeam.length !== requiredTeamSize) {
    toast(`本轮需要选择 ${requiredTeamSize} 名队员`, "warning");
    return;
  }
  socket.emit('submitTeam', { roomId: currentRoom, teamIndices: selectedTeam }, (response) => {
    if (!response.success) {
      toast(response.message, "error");
      return;
    }
    toast("队伍已提交，等待全员投票", "success");
    selectedTeam = [];
    updateLeaderSelectionHint();
  });
}

function vote(choice, button) {
  socket.emit('vote', { roomId: currentRoom, choice: choice }, (response) => {
    if (!response.success) {
      if (button) {
        button.classList.remove('loading');
        button.disabled = false;
      }
      toast(response.message || "投票失败", "error");
      return;
    }
    document.getElementById("voteActions").classList.add("hidden");
    toast("已投票", "success");
  });
}

function submitMission(result, button) {
  socket.emit('submitMission', { roomId: currentRoom, result: result }, (response) => {
    if (!response.success) {
      if (button) {
        button.classList.remove('loading');
        button.disabled = false;
      }
      toast(response.message || "提交失败", "error");
      return;
    }
    document.getElementById("missionActions").classList.add("hidden");
    toast("任务已匿名提交", "success");
  });
}

// 模态框
function showRanking() {
  socket.emit('getRanking', (list) => {
    const tbody = document.getElementById("rankingBody");
    tbody.innerHTML = '';
    list.slice(0, 20).forEach((u, i) => {
      const tr = document.createElement("tr");
      const rate = u.games_played > 0 ? Math.round(u.games_won / u.games_played * 100) : 0;
      tr.innerHTML = '<td>'+(i+1)+'</td><td>'+u.username+'</td><td>'+u.total_points+'</td><td>'+rate+'%</td>';
      tbody.appendChild(tr);
    });
    document.getElementById("rankingModal").classList.remove("hidden");
  });
}

function closeRanking() { document.getElementById("rankingModal").classList.add("hidden"); }
function showRules() { document.getElementById("rulesModal").classList.remove("hidden"); }
function closeRules() { document.getElementById("rulesModal").classList.add("hidden"); }

function showProfile() {
  document.getElementById("profilePhone").value = currentUser.phone;
  document.getElementById("profileUsername").value = currentUser.username;
  document.getElementById("avatarPreview").src = currentUser.avatar || "";
  socket.emit('getUser', { phone: currentUser.phone }, (user) => {
    if (user) {
      document.getElementById("statPoints").textContent = user.total_points || 0;
      document.getElementById("statPlayed").textContent = user.games_played || 0;
      document.getElementById("statWon").textContent = user.games_won || 0;
      const rate = user.games_played > 0 ? Math.round(user.games_won / user.games_played * 100) : 0;
      document.getElementById("statRate").textContent = rate + "%";
    }
  });
  document.getElementById("profileModal").classList.remove("hidden");
}

function closeProfile() { document.getElementById("profileModal").classList.add("hidden"); }

function updateProfile() {
  const username = document.getElementById("profileUsername").value.trim();
  if (username) {
    currentUser.username = username;
    saveLoginState(currentUser);
    toast("保存成功", "success");
  }
}

function uploadAvatar() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        currentUser.avatar = ev.target.result;
        document.getElementById("avatarPreview").src = currentUser.avatar;
        saveLoginState(currentUser);
        toast("头像已更新", "success");
      };
      reader.readAsDataURL(file);
    }
  };
  input.click();
}

// Init
checkLoginState();

// 房间创建弹窗
function showCreateRoomModal() {
  document.getElementById("createRoomModal").classList.remove("hidden");
  selectPlayerCount(5);
}

function closeCreateRoomModal() {
  document.getElementById("createRoomModal").classList.add("hidden");
}

function confirmCreateRoom() {
  closeCreateRoomModal();
  createRoom();
}

// 身份操作面板
function showIdentityActions() {
  if (!myRole || myRole === 'loyalist' || myRole === 'oberon') {
    toast("你的角色没有特殊技能", "info");
    return;
  }
  
  const roleActions = {
    'merlin': '你可以看到所有坏人，努力引导好人获胜！',
    'percival': '你看到的是梅林(?) - 小心，坏人可能假扮梅林！',
    'assassin': '当好人完成3次任务后，你可以刺杀梅林翻盘。',
    'minion': '你知道其他已知坏人，努力误导好人并破坏任务。'
  };
  
  let info = `角色: ${myRole}\n`;
  info += roleActions[myRole] || '';
  
  if (myRole === 'assassin') {
    info += '\n\n当进入刺杀阶段时，你会看到可选目标列表。';
  }
  
  // 创建身份操作面板
  const modal = document.createElement('div');
  modal.id = 'identityModal';
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <span class="close" onclick="closeIdentityModal()">×</span>
      <h2>🆔 身份信息</h2>
      <div class="role-info-box">
        <p>${info}</p>
      </div>
      <div id="allyList" class="ally-list"></div>
      <p style="color:var(--text-dim);font-size:12px;">请只在自己设备上查看，不要向其他玩家展示此面板。</p>
    </div>
  `;
  document.body.appendChild(modal);
  
  // 显示可见盟友
  updateAllyList();
}

function closeIdentityModal() {
  const modal = document.getElementById('identityModal');
  if (modal) modal.remove();
}

function updateAllyList() {
  const list = document.getElementById('allyList');
  if (!list) return;
  
  // 请求服务器获取可见信息
  socket.emit('checkAlly', { roomId: currentRoom }, (r) => {
    if (!r.success || !r.sees || r.sees.length === 0) {
      list.innerHTML = '<p style="color:var(--text-dim)">你没有特殊视角</p>';
      return;
    }
    
    let html = '<h4>你看到的玩家:</h4>';
    r.sees.forEach(s => {
      const typeLabel = s.type === 'evil' ? '坏人' : (s.type === 'good' ? '好人' : '?');
      const color = s.type === 'evil' ? '#ff6b6b' : '#90EE90';
      html += `<p style="color:${color}">${escapeHtml(s.username)} - ${typeLabel}</p>`;
    });
    list.innerHTML = html;
  });
}

// 指认功能（刺客专用）
function accusePlayer(targetPhone) {
  if (myRole !== 'assassin') {
    toast("只有刺客可以指认", "error");
    return;
  }
  
  socket.emit('accuse', { roomId: currentRoom, targetPhone }, (r) => {
    if (r.success) {
      toast(r.result, r.isCorrect ? "success" : "error");
    } else {
      toast(r.message, "error");
    }
  });
}

// ===== 交互反馈函数 =====

// 按钮点击反馈
function addButtonFeedback(btn) {
  if (!btn) return;
  btn.addEventListener('click', function(e) {
    this.classList.add('clicked');
    setTimeout(() => this.classList.remove('clicked'), 200);
  });
}

// 显示操作反馈
function showActionFeedback(elementId, type) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.classList.remove('feedback-success', 'feedback-error');
  void el.offsetWidth; // 触发重绘
  el.classList.add('feedback-' + type);
  setTimeout(() => el.classList.remove('feedback-' + type), 500);
}

// 队伍选择反馈
function toggleTeamMember(card, index) {
  const idx = selectedTeam.indexOf(index);
  if (idx > -1) {
    card.classList.toggle('selected');
    selectedTeam.splice(idx, 1);
    card.classList.remove('in-team');
  } else {
    if (selectedTeam.length >= requiredTeamSize) {
      toast(`本轮只能选择 ${requiredTeamSize} 名队员`, "warning");
      return;
    }
    card.classList.toggle('selected');
    selectedTeam.push(index);
    card.classList.add('in-team');
  }
  updateLeaderSelectionHint();
}

// 投票反馈
function voteWithFeedback(choice, event) {
  const btn = event?.currentTarget || event?.target;
  if (!btn) {
    vote(choice);
    return;
  }
  btn.classList.add('loading');
  btn.disabled = true;
  
  vote(choice, btn);
}

// 任务提交反馈
function submitMissionWithFeedback(result, event) {
  const btn = event?.currentTarget || event?.target;
  if (!btn) {
    submitMission(result);
    return;
  }
  btn.classList.add('loading');
  btn.disabled = true;
  
  submitMission(result, btn);
}

// 队伍提交反馈
function submitTeamWithFeedback(event) {
  const btn = event?.currentTarget || event?.target;
  if (selectedTeam.length === 0) {
    toast("请至少选择1名队员", "warning");
    return;
  }
  if (!btn) {
    submitTeam();
    return;
  }
  btn.classList.add('loading');
  btn.disabled = true;
  
  submitTeam();
  
  setTimeout(() => {
    btn.classList.remove('loading');
    btn.disabled = false;
  }, 3000);
}

// 初始化所有按钮反馈
function initButtonFeedback() {
  // 人数选择按钮
  document.querySelectorAll('.count-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('selected'));
      this.classList.add('selected');
    });
  });
  
  // 投票按钮
  const voteApprove = document.querySelector('button.approve');
  const voteReject = document.querySelector('button.reject');
  if (voteApprove) voteApprove.onclick = () => voteWithFeedback('approve');
  if (voteReject) voteReject.onclick = () => voteWithFeedback('reject');
}

// 更新队伍显示
function updateTeamDisplay() {
  document.querySelectorAll('.player-card').forEach((card, i) => {
    if (selectedTeam.includes(i)) {
      card.classList.add('in-team');
    } else {
      card.classList.remove('in-team');
    }
  });
}

function updateLeaderSelectionHint() {
  const description = document.querySelector('#leaderActions p');
  const submitButton = document.querySelector('#leaderActions button');
  if (description) {
    description.textContent = `本轮需要 ${requiredTeamSize} 人。当前已选择 ${selectedTeam.length} 人。`;
  }
  if (submitButton) {
    submitButton.disabled = selectedTeam.length !== requiredTeamSize;
  }
}

function renderAssassinationPanel(targets) {
  if (myRole !== 'assassin') {
    return;
  }

  const resultDiv = document.getElementById('resultDisplay');
  const title = document.getElementById('resultTitle');
  const message = document.getElementById('resultMessage');
  if (!resultDiv || !title || !message) return;

  title.textContent = "🗡️ 刺杀阶段";
  message.innerHTML = '<p>请选择你认为是梅林的玩家。该操作将直接结束游戏。</p>';

  targets.forEach((target) => {
    const button = document.createElement('button');
    button.textContent = `刺杀 ${target.username}`;
    button.style.margin = '8px 8px 0 0';
    button.onclick = () => assassinate(target.phone, target.username, button);
    message.appendChild(button);
  });

  resultDiv.classList.remove('hidden');
}

function assassinate(targetPhone, targetName, button) {
  const buttons = document.querySelectorAll('#resultMessage button');
  buttons.forEach((item) => {
    item.disabled = true;
  });
  if (button) {
    button.classList.add('loading');
  }
  socket.emit('assassinate', { roomId: currentRoom, targetPhone }, (response) => {
    if (!response.success) {
      buttons.forEach((item) => {
        item.disabled = false;
        item.classList.remove('loading');
      });
      toast(response.message || '刺杀失败', 'error');
      return;
    }
    toast(`你选择了 ${targetName}，等待结算`, 'warning');
  });
}

// 房主结束游戏
function endGameByHost() {
  if (!currentRoom) {
    toast("当前不在房间中", "warning");
    return;
  }
  if (!confirm("确定要解散游戏吗？所有玩家将被移出房间。")) {
    return;
  }
  socket.emit('hostEndGame', { roomId: currentRoom, phone: currentUser.phone }, (r) => {
    if (r.success) {
      toast("游戏已解散", "success");
      showScreen('lobby');
      currentRoom = null;
      gamePlayers = [];
      resetGameViewState();
      updateLobbyStats();
    } else {
      toast(r.message, "error");
    }
  });
}

// 游戏解散处理
socket.on('gameDismissed', (data) => {
  toast("游戏已解散: " + data.reason, "warning");
  showScreen('lobby');
  currentRoom = null;
  gamePlayers = [];
  resetGameViewState();
  setIdentityButtonsVisible(false);
});

// 测试模式 - 快速开始游戏
function startTestGame() {
  if (!currentRoom) {
    toast("请先进入房间，再开启测试模式", "warning");
    return;
  }
  if (!confirm("测试模式：将以电脑AI模拟4名玩家，立即开始游戏。是否继续？")) {
    return;
  }
  
  toast("正在准备测试游戏...", "info");
  
  // 请求服务器创建测试
  socket.emit('startTestGame', { roomId: currentRoom, phone: currentUser.phone }, (r) => {
    if (r.success) {
      toast("测试游戏已开始！", "success");
    } else {
      toast(r.message, "error");
    }
  });
}

// 更新队伍人数提示
function updateTeamSizeHint() {
  const hints = {
    5: "任务所需人数：2-3人",
    6: "任务所需人数：2-3人", 
    7: "任务所需人数：2-3人",
    8: "任务所需人数：2-4人",
    9: "任务所需人数：2-4人",
    10: "任务所需人数：3-4人"
  };
  const hint = hints[selectedPlayerCount] || "";
  document.getElementById("waitingHint").textContent = "等待玩家加入... (" + selectedPlayerCount + "人局) " + hint;
}
