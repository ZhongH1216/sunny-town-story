@echo off
setlocal EnableExtensions
cd /d "%~dp0"
call "%~dp0scripts\find-python.bat"
if errorlevel 1 (
  echo Python 3 was not found. Close the game server window instead.
  if /i not "%~1"=="/quiet" pause
  exit /b 1
)
"%SUNNY_GAME_PYTHON%" %SUNNY_GAME_PYTHON_ARGS% app.py --stop --state-file server.pid
set "SUNNY_STOP_RESULT=%ERRORLEVEL%"
if /i not "%~1"=="/quiet" pause
exit /b %SUNNY_STOP_RESULT%
