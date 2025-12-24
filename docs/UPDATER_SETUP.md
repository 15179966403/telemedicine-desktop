# 自动更新系统配置指南

## 概述

本文档描述如何配置和部署应用的自动更新系统。

## 生成更新密钥

```bash
# 安装 Tauri CLI
npm install -g @tauri-apps/cli

# 生成密钥对
tauri signer generate -w ~/.tauri/telemedicine.key
```

保存输出的公钥，将其添加到 `tauri.conf.json`。

## 配置更新服务器

### 服务器端点格式

```
GET /{{target}}/{{arch}}/{{current_version}}
```

参数说明：

- `target`: 平台（windows, darwin, linux）
- `arch`: 架构（x86_64, aarch64）
- `current_version`: 当前版本号

### 响应格式

```json
{
  "version": "1.0.1",
  "date": "2025-12-24T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "BASE64_SIGNATURE",
      "url": "https://releases.example.com/app-setup.exe"
    }
  },
  "notes": "更新内容"
}
```

## 签名更新包

```bash
tauri signer sign path/to/app.exe \
  --private-key ~/.tauri/telemedicine.key \
  --password "your_password"
```

## 测试更新

1. 构建旧版本应用
2. 部署更新服务器
3. 构建新版本并签名
4. 运行旧版本应用测试更新

## 注意事项

- 私钥必须安全保管
- 更新服务器必须使用 HTTPS
- 定期备份签名密钥
