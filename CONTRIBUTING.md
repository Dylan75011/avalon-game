# 开发规范

这份规范只服务一个目标：不要再让核心玩法因为字段漂移、阶段判断不一致或前端越权而坏掉。

## 一般原则

- 先保证一局能稳定跑完，再做新功能
- 前端只负责展示和交互，服务端负责最终判定
- 状态机改动优先更新文档，再改代码
- 任何会影响玩法的改动都必须做最小流程验证

## 状态机规范

当前服务端阶段枚举：

- `waiting`
- `team_building`
- `voting`
- `mission`
- `resolving_mission`
- `assassination`
- `ended`

约束：

- 阶段名只能在服务端定义和推进
- 前端不得自行推断胜负或操作者权限
- 新阶段或阶段字段变更时，必须同时更新 [API.md](/Users/yangdi/Documents/GitHub/avalon-game/API.md)

## 权限规范

所有敏感操作都必须以 `socket.phone` 作为真实身份来源，不能信任前端传入的 `phone`。

必须校验的操作包括：

- 开始游戏
- 提交队伍
- 投票
- 提交任务结果
- 刺杀
- 解散房间

## 前后端字段规范

- 数据库积分字段统一使用 `total_points`
- 投票字段统一使用 `choice`
- 队伍提议事件统一使用 `teamIndices`
- 下一轮队长统一使用 `leaderPhone` 和 `leaderUsername`

禁止：

- 同一语义在不同文件使用不同字段名
- 服务端发送 `username`，前端拿它和 `phone` 比较

## 文档规范

以下变化必须同步文档：

- Socket 契约变化：更新 [API.md](/Users/yangdi/Documents/GitHub/avalon-game/API.md)
- 用户可感知行为变化：更新 [README.md](/Users/yangdi/Documents/GitHub/avalon-game/README.md)
- 开发流程和约束变化：更新 [CONTRIBUTING.md](/Users/yangdi/Documents/GitHub/avalon-game/CONTRIBUTING.md)
- 优先级或迭代计划变化：更新 [TODO.md](/Users/yangdi/Documents/GitHub/avalon-game/TODO.md)

## 测试规范

涉及核心流程的改动，至少验证下面几项：

1. 5 人局可以完整开局
2. 非房主不能开局
3. 非队长不能提交队伍
4. 非任务队员不能提交任务结果
5. 一轮任务完成后能进入下一轮
6. 3 次成功后进入刺杀，3 次失败后直接结束

优先使用脚本化验证，不要只靠浏览器手点。

## 代码组织规范

- 游戏规则函数集中在服务端，避免散落在前端
- UI 辅助逻辑和状态恢复逻辑分开
- 新增复杂逻辑时，优先抽成小函数，不要继续堆在超长事件处理器里

## 提交前检查

提交前至少确认：

- `server.js` 和 `public/game.js` 无语法错误
- 核心 Socket 字段与 [API.md](/Users/yangdi/Documents/GitHub/avalon-game/API.md) 一致
- 没有把数据库字段名写错
- 没有让前端替代服务端做权限判断
