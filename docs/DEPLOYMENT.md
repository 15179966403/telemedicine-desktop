# 部署文档

## 概述

本文档描述了互联网医院桌面应用的部署流程，包括构建、打包、签名和分发。

## 系统要求

### 开发环境

- Node.js 18+
- npm 9+
- Rust 1.70+
- Cargo
- 操作系统：Windows 10+, macOS 10.13+, 或 Linux

### 构建工具

- Tauri CLI 2.0+
- TypeScript 5.0+
- Vite 7.0+

## 构建流程

### 1. 环境准备

```bash
# 克隆代码仓库
git clone <repository-url>
cd telemedicine-desktop

# 安装依赖
npm install

# 安装 Rust 依赖
cd src-tauri
cargo build
cd ..
```

### 2. 开发构建

```bash
# 启动开发服务器
npm run dev:tauri
```

### 3. 生产构建

#### Windows

```bash
# 使用构建脚本
.\scripts\build-release.bat

# 或手动构建
npm run build:windows
```

构建产物位置：`src-tauri/target/release/bundle/`

- NSIS 安装包：`nsis/*.exe`
- MSI 安装包：`msi/*.msi`

#### macOS

```bash
# Intel 芯片
npm run build:macos

# Apple Silicon (M1/M2)
npm run build:macos-arm
```

构建产物位置：`src-tauri/target/release/bundle/`

- DMG 镜像：`dmg/*.dmg`
- App Bundle：`macos/*.app`

#### Linux

```bash
npm run build:linux
```

构建产物位置：`src-tauri/target/release/bundle/`

- DEB 包：`deb/*.deb`
- AppImage：`appimage/*.AppImage`

## 应用签名

### Windows 代码签名

1. 获取代码签名证书（.pfx 文件）

2. 设置环境变量：

```bash
set TAURI_SIGNING_PRIVATE_KEY=path/to/certificate.pfx
set TAURI_SIGNING_PRIVATE_KEY_PASSWORD=your_password
```

3. 在 `tauri.conf.json` 中配置：

```json
{
  "bundle": {
    "windows": {
      "certificateThumbprint": "YOUR_CERTIFICATE_THUMBPRINT",
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.digicert.com"
    }
  }
}
```

### macOS 代码签名

1. 获取 Apple Developer 证书

2. 配置签名身份：

```bash
export APPLE_CERTIFICATE="Developer ID Application: Your Name (TEAM_ID)"
export APPLE_CERTIFICATE_PASSWORD="certificate_password"
```

3. 在 `tauri.conf.json` 中配置：

```json
{
  "bundle": {
    "macOS": {
      "signingIdentity": "Developer ID Application: Your Name (TEAM_ID)"
    }
  }
}
```

4. 公证应用（可选但推荐）：

```bash
xcrun notarytool submit path/to/app.dmg \
  --apple-id "your@email.com" \
  --team-id "TEAM_ID" \
  --password "app-specific-password"
```

## 自动更新配置

### 1. 生成更新密钥对

```bash
# 安装 Tauri CLI
npm install -g @tauri-apps/cli

# 生成密钥对
tauri signer generate -w ~/.tauri/myapp.key
```

这将生成：

- 私钥：`~/.tauri/myapp.key`
- 公钥：输出到控制台

### 2. 配置公钥

将公钥添加到 `tauri.conf.json`：

```json
{
  "app": {
    "updater": {
      "active": true,
      "pubkey": "YOUR_PUBLIC_KEY_HERE"
    }
  }
}
```

### 3. 签名更新包

```bash
# 签名更新包
tauri signer sign path/to/app.exe \
  --private-key ~/.tauri/myapp.key \
  --password "key_password"
```

### 4. 部署更新服务器

更新服务器需要提供以下端点：

```
GET /{{target}}/{{arch}}/{{current_version}}
```

响应格式：

```json
{
  "version": "1.0.1",
  "date": "2025-12-24T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "BASE64_SIGNATURE",
      "url": "https://releases.example.com/app-1.0.1-setup.exe"
    },
    "darwin-x86_64": {
      "signature": "BASE64_SIGNATURE",
      "url": "https://releases.example.com/app-1.0.1.dmg"
    }
  },
  "notes": "更新说明"
}
```

## 分发

### Windows

1. **直接下载**：提供 .exe 或 .msi 安装包下载链接
2. **企业分发**：通过内部软件管理系统分发
3. **自动更新**：配置更新服务器，应用自动检查更新

### macOS

1. **直接下载**：提供 .dmg 镜像文件
2. **App Store**：提交到 Mac App Store（需要额外配置）
3. **自动更新**：配置更新服务器

### Linux

1. **包管理器**：发布到 APT/YUM 仓库
2. **AppImage**：提供独立的 AppImage 文件
3. **Snap/Flatpak**：打包为 Snap 或 Flatpak

## 版本管理

### 版本号规范

遵循语义化版本（Semantic Versioning）：

- 主版本号：不兼容的 API 修改
- 次版本号：向下兼容的功能性新增
- 修订号：向下兼容的问题修正

示例：`1.2.3`

### 更新版本

1. 更新 `package.json` 中的版本号
2. 更新 `src-tauri/Cargo.toml` 中的版本号
3. 更新 `src-tauri/tauri.conf.json` 中的版本号
4. 提交代码并打标签

```bash
git add .
git commit -m "chore: bump version to 1.0.1"
git tag v1.0.1
git push origin main --tags
```

## 持续集成/持续部署 (CI/CD)

### GitHub Actions 示例

创建 `.github/workflows/release.yml`：

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    strategy:
      matrix:
        platform: [windows-latest, macos-latest, ubuntu-latest]

    runs-on: ${{ matrix.platform }}

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Setup Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: stable

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build:tauri

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: release-${{ matrix.platform }}
          path: src-tauri/target/release/bundle/
```

## 故障排查

### 构建失败

1. **依赖问题**：清理并重新安装依赖

   ```bash
   rm -rf node_modules
   npm install
   ```

2. **Rust 编译错误**：更新 Rust 工具链

   ```bash
   rustup update
   ```

3. **权限问题**：确保有足够的文件系统权限

### 签名失败

1. 检查证书是否有效
2. 验证证书密码
3. 确认证书未过期

### 更新失败

1. 检查更新服务器是否可访问
2. 验证签名是否正确
3. 确认版本号格式正确

## 安全建议

1. **保护私钥**：不要将签名私钥提交到版本控制系统
2. **使用环境变量**：敏感信息通过环境变量传递
3. **定期更新证书**：在证书过期前更新
4. **启用 HTTPS**：更新服务器必须使用 HTTPS
5. **验证签名**：始终验证下载文件的签名

## 监控和日志

### 应用监控

- 启动时间监控
- 崩溃报告收集
- 性能指标追踪

### 更新监控

- 更新成功率
- 更新失败原因
- 版本分布统计

## 支持和维护

### 技术支持

- 邮箱：support@telemedicine.example.com
- 文档：https://docs.telemedicine.example.com

### 问题反馈

- GitHub Issues：https://github.com/your-org/telemedicine-desktop/issues
- 崩溃报告：自动收集并发送到服务器

## 附录

### A. 构建环境检查清单

- [ ] Node.js 版本正确
- [ ] Rust 工具链已安装
- [ ] 所有依赖已安装
- [ ] 代码签名证书已配置
- [ ] 更新密钥已生成
- [ ] 环境变量已设置

### B. 发布检查清单

- [ ] 版本号已更新
- [ ] 更新日志已编写
- [ ] 所有测试通过
- [ ] 代码已签名
- [ ] 更新包已签名
- [ ] 更新服务器已配置
- [ ] 文档已更新

### C. 常用命令

```bash
# 开发
npm run dev:tauri

# 构建
npm run build:tauri

# 测试
npm run test

# 代码检查
npm run lint

# 格式化
npm run format
```
