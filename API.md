# API 文档

## 部署信息
- 服务器: http://47.81.9.246:80
- 协议: WebSocket (Socket.io)

## Socket 事件

### 客户端 → 服务器

| 事件 | 参数 | 说明 |
|------|------|------|
| `register` | `{phone, username}` | 注册/登录 |
| `getUser` | `{phone}` | 获取用户信息 |
| `getRanking` | - | 获取排行榜 |
| `createRoom` | `{phone, username, playerCount}` | 创建房间 |
| `joinRoom` | `{roomId, phone, username}` | 加入房间 |
| `leaveRoom` | `{roomId, phone}` | 离开房间 |
| `startGame` | `{roomId}` | 开始游戏 |
| `submitTeam` | `{roomId, teamIndices, leaderPhone}` | 提交队伍 |
| `vote` | `{roomId, phone, choice}` | 投票 |
| `submitMission` | `{roomId, phone, result}` | 任务结果 |
| `assassinate` | `{roomId, targetPhone}` | 刺杀 |

### 服务器 → 客户端

| 事件 | 参数 | 说明 |
|------|------|------|
| `connect` | - | 连接成功 |
| `disconnect` | - | 连接断开 |
| `reconnect` | - | 重新连接 |
| `playerJoined` | `{players}` | 玩家加入 |
| `playerLeft` | `{players, newHost}` | 玩家离开 |
| `gameStarted` | `{playerCount, players, roles}` | 游戏开始 |
| `teamProposed` | `{team, leader}` | 队伍提议 |
| `voteResult` | `{votes, isApproved}` | 投票结果 |
| `missionResult` | `{results, success, fails, round}` | 任务结果 |
| `assassinationPhase` | `{message}` | 刺杀阶段 |
| `assassinationResult` | `{targetPhone, targetRole, success}` | 刺杀结果 |
| `gameEnded` | `{winner, reason, roles}` | 游戏结束 |
| `nextRound` | `{round, leader}` | 下一轮 |

## 角色说明

| 角色 | 阵营 | 技能 |
|------|------|------|
| merlin | good | 知道所有坏人（除莫德雷德） |
| percival | good | 知道梅林 |
| loyalist | good | 无技能 |
| assassin | evil | 可刺杀梅林 |
| minion | evil | 知道梅林和其他坏人 |
| oberon | evil | 坏人但互相不知 |

## 人数配置

| 人数 | 角色 |
|------|------|
| 5 | merlin, percival, loyalist×2, assassin |
| 6 | + minion |
| 7 | + loyalist |
| 8 | + oberon |
| 9-10 | + 更多 loyalist/minion |

## 积分规则

- 胜利: +100 积分
- 参与: +20 积分

## 数据库表

### users
| 字段 | 类型 | 说明 |
|------|------|------|
| phone | TEXT PRIMARY KEY | 手机号（唯一ID） |
| username | TEXT | 昵称 |
| total_points | INTEGER | 总积分 |
| games_played | INTEGER | 游戏局数 |
| games_won | INTEGER | 获胜次数 |

### rooms
| 字段 | 类型 | 说明 |
|------|------|------|
| room_id | TEXT PRIMARY KEY | 房间邀请码 |
| host_phone | TEXT | 房主手机号 |
| game_status | TEXT | 等待中/进行中/已结束 |
| current_round | INTEGER | 当前轮次 |

### room_players
| 字段 | 类型 | 说明 |
|------|------|------|
| room_id | TEXT | 房间ID |
| phone | TEXT | 玩家手机号 |
| is_leader | INTEGER | 是否房主 |
