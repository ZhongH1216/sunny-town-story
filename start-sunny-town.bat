@echo off
setlocal

set "ROOT=%~dp0"
set "URL=http://127.0.0.1:8765"

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
node tools\start-server.js
if errorlevel 1 goto launch_failed

echo.
echo Opening %URL%
start "" "%URL%"
echo.
echo The server is running in the background.
echo You can double-click this launcher again to reopen the game.
echo.
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

:launch_failed
echo.
echo Launch failed. Please check server.err.log.
echo.
pause
exit /b 1
