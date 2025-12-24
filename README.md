# telemedicine-desktop

互联网医院桌面应用（Tauri 2 + React 19 + TypeScript）。前端基于 Vite，桌面端使用 Rust（SQLite 持久化、WebSocket 通信、文件处理、安全能力等）。

## 功能概览

- 登录与鉴权
- 问诊管理与详情查看
- 医患消息（含离线队列与重试）
- 多窗口与窗口状态持久化
- 文件上传与预览
- 安全与审计（本地存储加密/校验等）

## 技术栈

- 桌面：Tauri 2
- 前端：React 19、TypeScript、Vite、React Router
- 状态管理：Zustand
- 数据请求：@tanstack/react-query
- UI：Ant Design
- 通信：socket.io-client（前端）、Rust WebSocket 服务端能力
- 本地存储：SQLite（rusqlite）
- 测试：Vitest + Testing Library

## 目录结构

- `src/`：前端代码
- `src-tauri/`：Tauri（Rust）后端代码
- `docs/`：发布、打包、性能、升级等说明
- `scripts/`：构建/发布辅助脚本

## 环境要求

- Node.js（建议 LTS）
- Rust（stable）
- Tauri 2 依赖（Windows 需安装 Visual Studio Build Tools / MSVC 工具链）

## 本地开发

安装依赖：

```bash
npm install
```

仅启动前端（浏览器调试）：

```bash
npm run dev
```

以桌面应用方式启动（推荐日常开发）：

```bash
npm run dev:tauri
```

## 测试与质量

运行测试：

```bash
npm test
```

运行 ESLint：

```bash
npm run lint
```

格式化：

```bash
npm run format
```

## 构建

构建前端产物：

```bash
npm run build
```

构建桌面安装包（当前平台）：

```bash
npm run build:tauri
```

Windows 目标构建：

```bash
npm run build:windows
```

## 发布

- GitHub Actions：见 `.github/workflows/release.yml`
- 相关文档：见 `docs/` 目录（包含发布检查清单、自动更新、打包摘要等）

## 常见问题

- Windows 构建失败通常与 Rust/MSVC 工具链或 Tauri 依赖有关，请先确认本机已完成 Tauri 官方环境准备。
