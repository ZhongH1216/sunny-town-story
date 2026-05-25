@echo off
setlocal

set "ROOT=%~dp0"
set "PID_FILE=%ROOT%server.pid"
set "FOUND="

cd /d "%ROOT%"

echo.
echo Stopping Sunny Town Story...
echo.

for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":8765" ^| findstr "LISTENING"') do (
  set "FOUND=1"
  taskkill /PID %%P /F >nul 2>nul
  echo Server process %%P stopped.
)

del "%PID_FILE%" >nul 2>nul

if not defined FOUND echo No Sunny Town Story server was found.

echo.
pause
exit /b 0
