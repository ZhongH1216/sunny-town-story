@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
set "PID_FILE=%ROOT%server.pid"
set "FOUND="
set "PORT=8765"
set "QUIET="

if /i "%1"=="/quiet" set "QUIET=1"

cd /d "%ROOT%"

if exist ".env" (
  for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
    if /i "%%A"=="SUNNY_TOWN_PORT" set "PORT=%%B"
  )
)

if not defined QUIET (
  echo.
  echo Stopping Sunny Town Story...
  echo.
)

if exist "%PID_FILE%" (
  for /f "usebackq delims=" %%P in ("%PID_FILE%") do (
    if not "%%P"=="" (
      taskkill /PID %%P /F >nul 2>nul
      if errorlevel 1 powershell -NoProfile -Command "Stop-Process -Id %%P -Force -ErrorAction SilentlyContinue" >nul 2>nul
      if not errorlevel 1 (
        set "FOUND=1"
        if not defined QUIET echo Server process %%P stopped.
      )
    )
  )
)

for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
  taskkill /PID %%P /F >nul 2>nul
  if errorlevel 1 powershell -NoProfile -Command "Stop-Process -Id %%P -Force -ErrorAction SilentlyContinue" >nul 2>nul
  if not errorlevel 1 (
    set "FOUND=1"
    if not defined QUIET echo Server process %%P stopped.
  )
)

del "%PID_FILE%" >nul 2>nul

if not defined FOUND (
  if not defined QUIET echo No Sunny Town Story server was found.
)

if not defined QUIET (
  echo.
  pause
)
exit /b 0
