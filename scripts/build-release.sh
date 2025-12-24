#!/bin/bash
# 发布版本构建脚本

set -e

echo "=========================================="
echo "互联网医院桌面端 - 发布构建"
echo "=========================================="

# 检查环境
echo "检查构建环境..."
node --version
npm --version
cargo --version

# 清理旧的构建产物
echo "清理旧的构建产物..."
rm -rf dist
rm -rf src-tauri/target/release

# 安装依赖
echo "安装依赖..."
npm ci

# 运行测试
echo "运行测试..."
npm run test

# 代码检查
echo "代码检查..."
npm run lint

# 构建前端
echo "构建前端..."
npm run build

# 构建 Tauri 应用
echo "构建 Tauri 应用..."
npm run build:tauri

# 显示构建产物
echo "=========================================="
echo "构建完成！"
echo "=========================================="
echo "构建产物位置:"
ls -lh src-tauri/target/release/bundle/

echo ""
echo "构建成功！"
