# 阿瓦隆 Online (Avalon)

魔兽世界风格的多人在线推理游戏。

## 快速开始

```bash
cd ~/.openclaw/workspace/avalon-game
PORT=80 node server.js
```

访问: http://47.81.9.246

## 技术栈

- Node.js + Express
- Socket.io (实时通信)
- SQLite (sql.js)
- 原生 HTML/CSS/JS

## 项目结构

```
avalon-game/
├── server.js          # 后端服务 + 游戏逻辑
├── package.json       # 依赖配置
├── data/
│   └── game.db       # SQLite 数据库
├── public/
│   ├── index.html    # 页面结构
│   ├── game.js       # 前端逻辑
│   ├── style.css     # 样式
│   ├── icons.svg     # 内联SVG图标
│   └── icons/        # SVG图标文件
├── README.md         # 项目说明
├── API.md            # Socket API 文档
├── TODO.md           # 待办事项
├── TEST_PLAN.md      # 测试计划
└── TEST_REPORT.md    # 测试报告
```

## 功能列表

### 已完成
- [x] 手机号注册/登录
- [x] 昵称 + 自定义头像
- [x] 创建/加入房间（6位邀请码）
- [x] 人数选择（5-10人）
- [x] 角色分配（6种角色）
- [x] 队长组队 → 全员投票 → 任务执行
- [x] 3次成功/失败 胜负判定
- [x] 刺客刺杀阶段
- [x] 战绩积分系统
- [x] 排行榜
- [x] 个人中心
- [x] 断线重连
- [x] 手机端适配
- [x] 内联SVG图标

### 待完善
- [ ] 断线重连后状态恢复
- [ ] 房间聊天
- [ ] 音效反馈
- [ ] 游戏复盘

## 游戏规则

详见游戏内 "游戏规则" 按钮

## Socket API

详见 API.md

## 代码规范

1. **命名**: 驼峰命名法
2. **注释**: 复杂逻辑需注释
3. **变量**: 先声明后使用
4. **函数**: 单一职责
5. **文档**: 功能变更需同步更新 README.md 和 API.md

## 注意事项

- 使用 port 80 方便微信访问
- SQLite 数据保存在 data/game.db
- 内联SVG图标，无需外部资源
- 内存 rooms Map 管理实时游戏状态
