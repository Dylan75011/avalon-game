// Avalon Game Client

let socket = io();
let currentUser = null;
let currentRoom = null;
  document.getElementById("identityBtn").classList.add("hidden");
let selectedTeam = [];
let selectedPlayerCount = 5;
let gamePlayers = [];
let myRole = null;

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

// 头像生成
function generateAvatar(name, phone) {
  const colors = ['#c9a227', '#8b4513', '#2e8b57', '#4169e1', '#8b008b', '#cd5c5c', '#20b2aa', '#ff8c00', '#4682b4', '#9932cc'];
  const hash = phone.split('').reduce((a,b) => ((a<<5)-a)+b.charCodeAt(0),0);
  const color = colors[Math.abs(hash) % colors.length];
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:'+color+'"/><stop offset="100%" style="stop-color:#1a1510"/></linearGradient></defs><rect width="80" height="80" rx="40" fill="url(#g)"/><circle cx="40" cy="30" r="15" fill="'+color+'" opacity="0.8"/><ellipse cx="40" cy="65" rx="25" ry="20" fill="'+color+'" opacity="0.8"/><text x="40" y="55" font-size="28" fill="#fff" text-anchor="middle" font-family="serif">'+initial+'</text></svg>';
  
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
        avatar: generateAvatar(response.user.username, response.user.phone) 
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
      if (res.success) toast("已回到房间", "success");
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
      document.getElementById("totalPoints").textContent = user.points || 0;
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
      showScreen('room');
      document.getElementById("inviteCode").textContent = currentRoom;
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
      showScreen('room');
      document.getElementById("inviteCode").textContent = currentRoom;
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
  const needed = selectedPlayerCount - (gamePlayers.length || 0);
  if (needed > 0) {
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
  socket.emit('leaveRoom', { roomId: currentRoom, phone: currentUser.phone }, () => {
    currentRoom = null;
  document.getElementById("identityBtn").classList.add("hidden");
    gamePlayers = [];
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
  gamePlayers = data.players;
  myRole = data.myRole;
  document.getElementById("myRole").textContent = myRole;
  
  // 显示角色信息
  showRoleStart(data);
  document.getElementById("identityBtn").classList.remove("hidden");
  // 如果是房主，显示解散按钮
  if (gamePlayers.length > 0 && gamePlayers[0].phone === currentUser.phone) {
    document.getElementById("hostDismissBtn").classList.remove("hidden");
    document.getElementById("hostActions").classList.remove("hidden");
  }
  
  updatePhase("🎮 游戏开始", "你的角色: " + myRole);
  toast("游戏开始！你的角色: " + myRole, "success");
  updatePlayersGrid();
  if (data.players[0].phone === currentUser.phone) showLeaderActions();
});

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
    'merlin': '你知道所有坏人的身份（除莫德雷德）',
    'percival': '你知道梅林是谁',
    'loyalist': '努力找出坏人',
    'assassin': '你可以刺杀梅林',
    'minion': '你知道梅林和其他坏人',
    'oberon': '你是坏人但互相不知道身份'
  };
  
  // 创建角色信息面板
  let info = `你的角色: ${roleNames[role] || role}\n`;
  info += `${roleDesc[role] || ''}\n`;
  
  // 显示能看到的信息
  if (sees && sees.length > 0) {
    info += '\n你看到: ';
    if (role === 'percival') {
      info += sees.map(s => s.username + '(?)').join(', ');
    } else {
      info += sees.map(s => s.username + '(' + (s.type === 'evil' ? '坏人' : '好人') + ')').join(', ');
    }
  } else if (role === 'loyalist' || role === 'oberon') {
    info += '\n你没有特殊视角，努力分析吧！';
  }
  
  // 在结果面板显示角色信息
  const resultDiv = document.getElementById('resultDisplay');
  resultDiv.classList.remove('hidden');
  document.getElementById('resultTitle').textContent = roleNames[role] || role;
  document.getElementById('resultMessage').textContent = info;
  
  // 5秒后隐藏
  setTimeout(() => {
    resultDiv.classList.add('hidden');
  }, 5000);
}

socket.on('teamProposed', (data) => {
  updatePhase("🗳️ 投票阶段", "队长已提交队伍");
  const teamNames = data.team.map(i => gamePlayers[i]?.username).join(', ');
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
      updatePhase("⚔️ 任务阶段", "执行任务...");
      showMissionActions();
      resultDiv.classList.add('hidden');
    } else {
      updatePhase("🔄 重新组队", "队伍被否决，等待下一轮");
    }
  }, 3000);
});

socket.on('missionResult', (data) => {
  const result = data.success ? "✅ 成功" : "❌ 失败";
  
  // 显示结果面板
  const resultDiv = document.getElementById('resultDisplay');
  resultDiv.classList.remove('hidden');
  document.getElementById('resultTitle').textContent = "任务" + result;
  
  // 显示任务详情
  let missionDetails = [];
  for (let [phone, r] of Object.entries(data.results)) {
    const player = gamePlayers.find(p => p.phone === phone);
    const name = player ? player.username : "未知";
    missionDetails.push(name + ": " + (r === "success" ? "✓成功" : "✗失败"));
  }
  document.getElementById('resultMessage').textContent = missionDetails.join('\n') + "\n\n失败票: " + (data.fails||0);
  
  setTimeout(() => {
    resultDiv.classList.add('hidden');
    // 如果是下一轮，队长可以开始组队
  }, 3000);
  
  updateGameProgress(data.round);
  updateLobbyStats();
});

socket.on('assassinationPhase', (data) => {
  updatePhase("🗡️ 刺杀阶段", "刺客选择梅林");
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
  document.getElementById("identityBtn").classList.add("hidden");
    myRole = null;
    gamePlayers = [];
    updateLobbyStats();
  };
  resultDiv.querySelector('#resultMessage').appendChild(document.createElement('br'));
  resultDiv.querySelector('#resultMessage').appendChild(backBtn);
  
  // 不自动返回，等待玩家点击
});

socket.on('nextRound', (data) => {
  updateGameProgress(data.round);
  updatePhase("第 " + data.round + " 轮", "队长: " + data.leader);
  if (data.leader === currentUser.phone) showLeaderActions();
});

// UI更新
function updateRoomUI() {
  const list = document.getElementById("players");
  list.innerHTML = '';
  gamePlayers.forEach(p => {
    const li = document.createElement("li");
    li.className = "player-waiting-card";
    li.innerHTML = '<div class="player-avatar">'+(p.avatar || '👤')+'</div><div class="player-info"><div class="player-name">'+p.username+'</div><div class="player-status '+(p.isLeader?'host':'')+'">'+(p.isLeader?'👑 房主':'玩家')+'</div></div>';
    list.appendChild(li);
  });
  document.getElementById("playerCount").textContent = gamePlayers.length;
  updateStartButton();
}

function updatePlayersGrid() {
  const grid = document.getElementById("playersGrid");
  grid.innerHTML = '';
  gamePlayers.forEach((p, i) => {
    const card = document.createElement("div");
    card.className = "player-card";
    card.id = "player-" + i;
    card.innerHTML = '<div class="player-card-avatar">'+(p.avatar || '👤')+'</div><div class="name">'+p.username+'</div><div class="status"></div>';
    grid.appendChild(card);
  });
}

function updateGameProgress(round) {
  const progress = document.getElementById("gameProgress");
  progress.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const step = document.createElement("div");
    step.className = "progress-step";
    if (i < round) {
      step.textContent = "✓";
      step.classList.add("success");
    } else if (i === round) {
      step.textContent = i;
      step.classList.add("current");
    } else {
      step.textContent = i;
    }
    progress.appendChild(step);
  }
}

function showLeaderActions() {
  document.getElementById("leaderActions").classList.remove("hidden");
  document.getElementById("voteActions").classList.add("hidden");
  document.getElementById("missionActions").classList.add("hidden");
  updatePhase("⚔️ 组队阶段", "选择任务成员");
  document.querySelectorAll('.player-card').forEach((card, i) => {
    card.onclick = () => {
      card.classList.toggle("selected");
      const idx = selectedTeam.indexOf(i);
      if (idx > -1) selectedTeam.splice(idx, 1);
      else selectedTeam.push(i);
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
  document.getElementById("missionActions").classList.remove("hidden");
}

function submitTeam() {
  socket.emit('submitTeam', { roomId: currentRoom, teamIndices: selectedTeam, leaderPhone: currentUser.phone }, (response) => {
    if (!response.success) toast(response.message, "error");
    selectedTeam = [];
  });
}

function vote(choice) {
  socket.emit('vote', { roomId: currentRoom, phone: currentUser.phone, choice: choice }, () => {
    document.getElementById("voteActions").classList.add("hidden");
    toast("已投票", "success");
  });
}

function submitMission(result) {
  socket.emit('submitMission', { roomId: currentRoom, phone: currentUser.phone, result: result }, () => {
    document.getElementById("missionActions").classList.add("hidden");
    toast("任务已提交", "success");
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
      tr.innerHTML = '<td>'+(i+1)+'</td><td>'+u.username+'</td><td>'+u.points+'</td><td>'+rate+'%</td>';
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
      document.getElementById("statPoints").textContent = user.points || 0;
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
    'assassin': '任务失败后可以刺杀梅林获胜',
    'minion': '你知道梅林和其他坏人，努力破坏！'
  };
  
  let info = `角色: ${myRole}\n`;
  info += roleActions[myRole] || '';
  
  if (myRole === 'assassin') {
    info += '\n\n点击其他玩家可以指认ta的身份';
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
      ${myRole === 'assassin' ? '<p style="color:var(--text-dim);font-size:12px;">* 点击其他玩家可以指认</p>' : ''}
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
  socket.emit('checkAlly', { roomId: currentRoom, phone: currentUser.phone }, (r) => {
    if (!r.success || !r.sees || r.sees.length === 0) {
      list.innerHTML = '<p style="color:var(--text-dim)">你没有特殊视角</p>';
      return;
    }
    
    let html = '<h4>你看到的玩家:</h4>';
    r.sees.forEach(s => {
      const typeLabel = s.type === 'evil' ? '坏人' : (s.type === 'good' ? '好人' : '?');
      const color = s.type === 'evil' ? '#ff6b6b' : '#90EE90';
      html += `<p style="color:${color}">${s.username} - ${typeLabel}</p>`;
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
  
  socket.emit('accuse', { roomId: currentRoom, phone: currentUser.phone, targetPhone }, (r) => {
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
  card.classList.toggle('selected');
  
  const idx = selectedTeam.indexOf(index);
  if (idx > -1) {
    selectedTeam.splice(idx, 1);
    card.classList.remove('in-team');
  } else {
    selectedTeam.push(index);
    card.classList.add('in-team');
  }
}

// 投票反馈
function voteWithFeedback(choice) {
  const btn = event.target;
  btn.classList.add('loading');
  btn.disabled = true;
  
  vote(choice);
}

// 任务提交反馈
function submitMissionWithFeedback(result) {
  const btn = event.target;
  btn.classList.add('loading');
  btn.disabled = true;
  
  submitMission(result);
}

// 队伍提交反馈
function submitTeamWithFeedback() {
  const btn = event.target;
  if (selectedTeam.length === 0) {
    toast("请至少选择1名队员", "warning");
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

// 房主结束游戏
function endGameByHost() {
  if (!confirm("确定要解散游戏吗？所有玩家将被移出房间。")) {
    return;
  }
  socket.emit('hostEndGame', { roomId: currentRoom, phone: currentUser.phone }, (r) => {
    if (r.success) {
      toast("游戏已解散", "success");
      showScreen('lobby');
      currentRoom = null;
      myRole = null;
      gamePlayers = [];
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
  myRole = null;
  gamePlayers = [];
});

// 测试模式 - 快速开始游戏
function startTestGame() {
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
