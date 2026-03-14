# API 文档

本文档描述当前前后端使用的 Socket.io 事件契约。核心原则只有一条：客户端负责展示，服务端负责状态机和权限判断。

## 连接信息

- 协议: Socket.io over WebSocket
- 默认本地地址: [http://localhost:3000](http://localhost:3000)

## 数据约定

### 用户对象

```json
{
  "phone": "13900000000",
  "username": "玩家A",
  "total_points": 120,
  "games_played": 3,
  "games_won": 1
}
```

### 房间玩家对象

```json
{
  "phone": "13900000000",
  "username": "玩家A",
  "avatar": "data:image/...",
  "isLeader": true
}
```

### 游戏阶段

- `waiting`: 等待开局
- `team_building`: 队长组队
- `voting`: 全员投票
- `mission`: 任务执行
- `resolving_mission`: 任务结算中
- `assassination`: 刺杀阶段
- `ended`: 对局结束

## 客户端 -> 服务端

### `register`

参数:

```json
{
  "phone": "13900000000",
  "username": "玩家A"
}
```

返回:

```json
{
  "success": true,
  "user": {
    "phone": "13900000000",
    "username": "玩家A",
    "total_points": 0,
    "games_played": 0,
    "games_won": 0
  },
  "isNew": true
}
```

### `getUser`

参数:

```json
{
  "phone": "13900000000"
}
```

### `getRanking`

参数: 无

### `createRoom`

参数:

```json
{
  "phone": "13900000000",
  "playerCount": 5
}
```

说明:

- `phone` 必须和当前 socket 已登录用户一致
- 只允许 5 到 10 人局

### `joinRoom`

参数:

```json
{
  "roomId": "ABC123",
  "phone": "13900000000"
}
```

说明:

- 开局前允许新玩家加入
- 开局后仅允许房间内原玩家重连回房

### `leaveRoom`

参数:

```json
{
  "roomId": "ABC123",
  "phone": "13900000000"
}
```

说明:

- 对局进行中会被拒绝，防止误触中断整局游戏

### `startGame`

参数:

```json
{
  "roomId": "ABC123"
}
```

说明:

- 仅房主可发起
- 当前人数必须等于开房时选择的人数

### `submitTeam`

参数:

```json
{
  "roomId": "ABC123",
  "teamIndices": [0, 1, 2]
}
```

说明:

- 仅当前队长可发起
- `teamIndices` 必须去重且满足当前轮所需人数

### `vote`

参数:

```json
{
  "roomId": "ABC123",
  "choice": "approve"
}
```

可选值:

- `approve`
- `reject`

说明:

- 每位玩家每次提案只能投 1 次

### `submitMission`

参数:

```json
{
  "roomId": "ABC123",
  "result": "success"
}
```

可选值:

- `success`
- `fail`

说明:

- 仅当前任务队员可以提交
- 好人角色不能提交 `fail`

### `assassinate`

参数:

```json
{
  "roomId": "ABC123",
  "targetPhone": "13900000002"
}
```

说明:

- 仅刺杀阶段可用
- 仅刺客可发起

### `checkAlly`

参数:

```json
{
  "roomId": "ABC123"
}
```

### `accuse`

参数:

```json
{
  "roomId": "ABC123",
  "targetPhone": "13900000002"
}
```

说明:

- 当前已禁用，仅保留兼容占位
- 服务端会返回失败提示，引导用户改用正式刺杀流程

### `hostEndGame`

参数:

```json
{
  "roomId": "ABC123",
  "phone": "13900000000"
}
```

### `startTestGame`

参数:

```json
{
  "roomId": "ABC123",
  "phone": "13900000000"
}
```

说明:

- 仅房主可发起
- 当前用于本地调试，不应作为正式玩法入口

## 服务端 -> 客户端

### `playerJoined`

```json
{
  "players": []
}
```

### `playerLeft`

```json
{
  "players": [],
  "newHost": "13900000001"
}
```

### `gameStarted`

### `joinRoom` 的 `gameState`

两者返回相同结构，用于开局和重连恢复：

```json
{
  "players": [],
  "round": 1,
  "myRole": "merlin",
  "mySees": [],
  "playerCount": 5,
  "leaderPhone": "13900000001",
  "leaderUsername": "玩家A",
  "phase": "team_building",
  "proposalCount": 0,
  "approvedTeamPhones": []
}
```

### `teamProposed`

```json
{
  "teamIndices": [0, 1],
  "leaderPhone": "13900000001",
  "leaderUsername": "玩家A",
  "requiredTeamSize": 2
}
```

### `voteResult`

```json
{
  "votes": {
    "13900000001": "approve"
  },
  "isApproved": true,
  "approvedTeamPhones": ["13900000001", "13900000002"]
}
```

### `missionResult`

```json
{
  "success": true,
  "fails": 0,
  "successes": 1,
  "failures": 0,
  "round": 1
}
```

说明:

- 任务结果匿名结算，不返回每位队员各自提交的结果
- `teamSize` 表示本次任务参与人数

### `nextRound`

```json
{
  "round": 2,
  "leaderPhone": "13900000002",
  "leaderUsername": "玩家B",
  "proposalCount": 0
}
```

### `assassinationPhase`

```json
{
  "message": "好人已完成3轮任务，刺客选择梅林！",
  "assassinPhone": "13900000005",
  "targets": [
    {
      "phone": "13900000002",
      "username": "玩家B"
    }
  ]
}
```

### `assassinationResult`

```json
{
  "success": false
}
```

### `gameEnded`

```json
{
  "winner": "good",
  "reason": "刺客刺杀失败，好人胜利！",
  "roles": [
    {
      "username": "玩家A"
    }
  ]
}
```

### `gameDismissed`

```json
{
  "reason": "房主解散了游戏"
}
```

## 规则实现说明

### 角色配置

| 人数 | 角色 |
|------|------|
| 5 | merlin, percival, loyalist, loyalist, assassin |
| 6 | merlin, percival, loyalist, loyalist, assassin, minion |
| 7 | merlin, percival, loyalist, loyalist, loyalist, assassin, minion |
| 8 | merlin, percival, loyalist, loyalist, loyalist, assassin, minion, oberon |
| 9 | merlin, percival, loyalist, loyalist, loyalist, loyalist, assassin, minion, oberon |
| 10 | merlin, percival, loyalist, loyalist, loyalist, loyalist, loyalist, assassin, minion, oberon |

### 每轮任务人数

| 人数 | 第1轮 | 第2轮 | 第3轮 | 第4轮 | 第5轮 |
|------|------:|------:|------:|------:|------:|
| 5 | 2 | 3 | 2 | 3 | 3 |
| 6 | 2 | 3 | 4 | 3 | 4 |
| 7 | 2 | 3 | 3 | 4 | 4 |
| 8 | 3 | 4 | 4 | 5 | 5 |
| 9 | 3 | 4 | 4 | 5 | 5 |
| 10 | 3 | 4 | 4 | 5 | 5 |

### 任务失败阈值

- 默认 1 张 `fail` 即任务失败
- 7 人及以上第 4 轮需要 2 张 `fail`

### 服务端权限规则

- 只有房主能开局和解散房间
- 只有当前队长能提交队伍
- 只有任务队员能提交任务结果
- 所有敏感操作都以 `socket.phone` 为准，不信任前端传入的 `phone`

## 数据库

### `users`

| 字段 | 类型 | 说明 |
|------|------|------|
| `phone` | TEXT PRIMARY KEY | 手机号 |
| `username` | TEXT | 昵称 |
| `total_points` | INTEGER | 总积分 |
| `games_played` | INTEGER | 游戏局数 |
| `games_won` | INTEGER | 获胜次数 |

### `rooms`

| 字段 | 类型 | 说明 |
|------|------|------|
| `room_id` | TEXT PRIMARY KEY | 房间邀请码 |
| `host_phone` | TEXT | 房主手机号 |
| `game_status` | TEXT | waiting / in_progress / ended |
| `current_round` | INTEGER | 当前轮次 |

### `room_players`

| 字段 | 类型 | 说明 |
|------|------|------|
| `room_id` | TEXT | 房间 ID |
| `phone` | TEXT | 玩家手机号 |
| `role` | TEXT | 角色 |
| `status` | TEXT | 玩家状态 |
| `is_leader` | INTEGER | 是否房主 |
