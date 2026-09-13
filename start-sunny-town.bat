@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo.
echo Sunny Town Story - Demo
echo.

if not exist "node_modules\three\build\three.module.js" goto missing_files
if not exist "node_modules\three\build\three.core.js" goto missing_files
call "%~dp0scripts\find-python.bat"
if errorlevel 1 goto missing_python

set "SUNNY_GAME_PORT=8765"
if defined SUNNY_TOWN_PORT set "SUNNY_GAME_PORT=%SUNNY_TOWN_PORT%"
echo Opening http://127.0.0.1:%SUNNY_GAME_PORT% in your browser.
echo Keep this window open while playing. Press Ctrl+C to stop.
echo Saves are stored in this browser; use the same port to continue.
echo.
"%SUNNY_GAME_PYTHON%" %SUNNY_GAME_PYTHON_ARGS% app.py --host 127.0.0.1 --port "%SUNNY_GAME_PORT%" --state-file server.pid --open-browser
if errorlevel 1 goto launch_failed
exit /b 0

:missing_files
echo Game files are incomplete. Extract the entire ZIP into a folder first.
echo Developers: run npm ci to install the locked dependencies.
goto failed

:missing_python
echo Python 3.10 or newer is required. Node.js and npm are NOT needed to play.
echo Install Python from https://www.python.org/downloads/ then try again.
echo Or set SUNNY_TOWN_PYTHON to your Python executable path.
goto failed

:launch_failed
echo.
echo The game server could not start. See the message above.
echo If this game is already open, use that browser window or stop-sunny-town.bat.

:failed
echo.
pause
exit /b 1
