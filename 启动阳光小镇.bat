@echo off
setlocal
chcp 65001 >nul

set "ROOT=%~dp0"
set "URL=http://127.0.0.1:8765"

cd /d "%ROOT%"

echo.
echo 正在启动《阳光小镇物语》...
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo 未找到 Node.js。请先安装 Node.js，或确认 npm.cmd test 能正常运行。
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\three\build\three.module.js" (
  echo 首次运行需要安装依赖，正在执行 npm install...
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo 依赖安装失败，请检查网络或 npm 环境。
    pause
    exit /b 1
  )
)

node tools\start-server.js
if errorlevel 1 (
  echo.
  echo 启动失败，请查看 server.err.log。
  pause
  exit /b 1
)

echo.
echo 浏览器即将打开：%URL%
start "" "%URL%"
echo.
echo 服务已在后台运行。关闭游戏页面不会自动停止服务。
echo 如果需要重启，直接再次双击本文件即可。
echo.
pause
