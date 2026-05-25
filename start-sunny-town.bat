@echo off
setlocal

set "ROOT=%~dp0"
set "URL=http://127.0.0.1:8765"
set "PYTHON=D:\python\anaconda\envs\aigo\python.exe"

cd /d "%ROOT%"

echo.
echo Starting Sunny Town Story...
echo.

where node >nul 2>nul
if errorlevel 1 goto missing_node

if exist "node_modules\three\build\three.module.js" goto launch

echo Dependencies were not found. Running npm install...
call npm.cmd install
if errorlevel 1 goto install_failed

:launch
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":8765" ^| findstr "LISTENING"') do (
  echo Stopping old server process %%P...
  taskkill /PID %%P /F >nul 2>nul
)

echo Opening browser in a moment: %URL%
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 1; Start-Process '%URL%'"
echo.
echo Keep this window open while playing.
echo To stop the game, close this window or press Ctrl+C.
echo If a server is stuck, use stop-sunny-town.bat.
echo.
"%PYTHON%" app.py --host 127.0.0.1 --port 8765
echo.
echo Sunny Town Story has stopped.
pause
exit /b 0

:missing_node
echo Node.js was not found.
echo Please install Node.js or check that npm.cmd test works first.
echo.
pause
exit /b 1

:install_failed
echo.
echo npm install failed. Please check your network or npm setup.
echo.
pause
exit /b 1
