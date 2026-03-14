# TODO

## P0 - 稳定性

- [ ] 清理 [public/index.html](/Users/yangdi/Documents/GitHub/avalon-game/public/index.html) 的重复 `id`、多余闭合标签和结构嵌套问题
- [ ] 为核心状态机补自动化流程测试：开局、组队、投票、任务、刺杀、重连
- [ ] 完善服务端重启后的房间恢复策略，避免线下局被中断

## P1 - 线下可用性

- [ ] 重连后恢复更完整的上下文提示，例如当前队伍、投票结果、轮次说明
- [ ] 个人中心修改昵称后同步写回服务端
- [ ] 明确房主离开后的游戏策略，是移交房主还是直接解散
- [ ] 为刺杀阶段增加清晰的目标选择 UI

## P2 - 体验增强

- [ ] 房间聊天
- [ ] 游戏复盘
- [ ] 音效和动效反馈
- [ ] 房主踢人

## P3 - 工程化

- [ ] 将 [server.js](/Users/yangdi/Documents/GitHub/avalon-game/server.js) 拆为房间、规则、用户、结算模块
- [ ] 增加 ESLint / Prettier
- [ ] 增加 CI，至少覆盖语法检查和核心流程测试

## 文档同步规则

以下内容发生变化时必须同步更新文档：

- Socket 事件、字段、返回结构变化：更新 [API.md](/Users/yangdi/Documents/GitHub/avalon-game/API.md)
- 游戏规则、部署方式、项目目标变化：更新 [README.md](/Users/yangdi/Documents/GitHub/avalon-game/README.md)
- 开发约束、流程、代码组织变化：更新 [CONTRIBUTING.md](/Users/yangdi/Documents/GitHub/avalon-game/CONTRIBUTING.md)
