@echo off
REM 发布版本构建脚本 (Windows)

echo ==========================================
echo 互联网医院桌面端 - 发布构建
echo ==========================================

REM 检查环境
echo 检查构建环境...
node --version
npm --version
cargo --version

REM 清理旧的构建产物
echo 清理旧的构建产物...
if exist dist rmdir /s /q dist
if exist src-tauri\target\release rmdir /s /q src-tauri\target\release

REM 安装依赖
echo 安装依赖...
call npm ci

REM 运行测试
echo 运行测试...
call npm run test

REM 代码检查
echo 代码检查...
call npm run lint

REM 构建前端
echo 构建前端...
call npm run build

REM 构建 Tauri 应用
echo 构建 Tauri 应用...
call npm run build:tauri

REM 显示构建产物
echo ==========================================
echo 构建完成！
echo ==========================================
echo 构建产物位置:
dir src-tauri\target\release\bundle\

echo.
echo 构建成功！
pause
