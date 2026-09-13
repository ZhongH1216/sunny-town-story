@echo off
rem Shared runtime discovery. The caller owns SETLOCAL so these values survive.
set "SUNNY_GAME_PYTHON="
set "SUNNY_GAME_PYTHON_ARGS="
if exist "%~dp0..\.env" for /f "usebackq tokens=1,* delims==" %%A in ("%~dp0..\.env") do (
  if /i "%%A"=="SUNNY_TOWN_PYTHON" if not defined SUNNY_TOWN_PYTHON set "SUNNY_TOWN_PYTHON=%%~B"
  if /i "%%A"=="SUNNY_TOWN_PORT" if not defined SUNNY_TOWN_PORT set "SUNNY_TOWN_PORT=%%~B"
)
if defined SUNNY_TOWN_PYTHON call :candidate "%SUNNY_TOWN_PYTHON%"
if defined SUNNY_GAME_PYTHON exit /b 0
if exist "%~dp0..\runtime\python\python.exe" call :candidate "%~dp0..\runtime\python\python.exe"
if defined SUNNY_GAME_PYTHON exit /b 0
py -3 -c "import sys; assert sys.version_info >= (3, 10)" >nul 2>nul
if not errorlevel 1 (
  set "SUNNY_GAME_PYTHON=py"
  set "SUNNY_GAME_PYTHON_ARGS=-3"
  exit /b 0
)
call :candidate python
if defined SUNNY_GAME_PYTHON exit /b 0
if defined CONDA_PREFIX call :candidate "%CONDA_PREFIX%\python.exe"
if defined SUNNY_GAME_PYTHON exit /b 0
for %%D in ("%USERPROFILE%\.conda\envs\sunny-town-dev" "%USERPROFILE%\miniconda3\envs\sunny-town-dev" "%USERPROFILE%\anaconda3\envs\sunny-town-dev" "C:\Python\anaconda3\envs\sunny-town-dev") do if not defined SUNNY_GAME_PYTHON call :candidate "%%~D\python.exe"
if defined SUNNY_GAME_PYTHON exit /b 0
exit /b 1

:candidate
"%~1" -c "import sys; assert sys.version_info >= (3, 10)" >nul 2>nul
if not errorlevel 1 set "SUNNY_GAME_PYTHON=%~1"
exit /b 0
