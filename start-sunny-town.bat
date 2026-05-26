@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
set "CONDA_ENV=sunny-town-dev"
set "HOST=127.0.0.1"
set "PORT=8765"
set "CONDA_CMD="
set "CONDA_PREFIX_PATH="
set "PYTHON_CMD="
set "PYTHON_ARGS="
set "NPM_CMD="
set "HAS_CONDA_ENV="

cd /d "%ROOT%"

echo.
echo Starting Sunny Town Story...
echo.

if exist ".env" (
  for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
    if /i "%%A"=="SUNNY_TOWN_PYTHON" set "PYTHON_CMD=%%B"
    if /i "%%A"=="SUNNY_TOWN_HOST" set "HOST=%%B"
    if /i "%%A"=="SUNNY_TOWN_PORT" set "PORT=%%B"
  )
)
set "URL=http://%HOST%:%PORT%"

call :find_conda
call :find_conda_env

if not defined HAS_CONDA_ENV (
  if defined CONDA_CMD (
    echo Development environment %CONDA_ENV% was not found.
    echo Creating it now. This can take a few minutes on first run.
    echo.
    call "%ROOT%scripts\setup-dev.bat" --skip-browsers
    if errorlevel 1 goto setup_failed
    call :find_conda_env
  )
)

if defined HAS_CONDA_ENV (
  set "PYTHON_CMD=%CONDA_PREFIX_PATH%\python.exe"
  set "PYTHON_ARGS="
  set "NPM_CMD=%CONDA_PREFIX_PATH%\npm.cmd"
  goto tools_ready
)

if defined PYTHON_CMD goto find_global_npm

where py >nul 2>nul
if not errorlevel 1 (
  set "PYTHON_CMD=py"
  set "PYTHON_ARGS=-3"
  goto find_global_npm
)

where python >nul 2>nul
if not errorlevel 1 (
  set "PYTHON_CMD=python"
  goto find_global_npm
)

goto missing_python

:find_global_npm
where npm.cmd >nul 2>nul
if not errorlevel 1 (
  set "NPM_CMD=npm.cmd"
  goto tools_ready
)
goto missing_npm

:tools_ready
call "%PYTHON_CMD%" %PYTHON_ARGS% --version >nul 2>nul
if errorlevel 1 goto missing_python

call "%NPM_CMD%" --version >nul 2>nul
if errorlevel 1 goto missing_npm

if exist "node_modules\three\build\three.module.js" goto launch

echo Dependencies were not found. Running npm install...
call "%NPM_CMD%" install
if errorlevel 1 goto install_failed

:launch
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
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

set "SUNNY_TOWN_PYTHON=%PYTHON_CMD%"
call "%PYTHON_CMD%" %PYTHON_ARGS% app.py --host %HOST% --port %PORT%

echo.
echo Sunny Town Story has stopped.
exit /b 0

:find_conda
where conda >nul 2>nul
if not errorlevel 1 (
  set "CONDA_CMD=conda"
  exit /b 0
)
if exist "%USERPROFILE%\miniconda3\condabin\conda.bat" set "CONDA_CMD=%USERPROFILE%\miniconda3\condabin\conda.bat"
if exist "%USERPROFILE%\anaconda3\condabin\conda.bat" set "CONDA_CMD=%USERPROFILE%\anaconda3\condabin\conda.bat"
if exist "C:\ProgramData\miniconda3\condabin\conda.bat" set "CONDA_CMD=C:\ProgramData\miniconda3\condabin\conda.bat"
if exist "C:\ProgramData\anaconda3\condabin\conda.bat" set "CONDA_CMD=C:\ProgramData\anaconda3\condabin\conda.bat"
if exist "C:\Python\anaconda3\condabin\conda.bat" set "CONDA_CMD=C:\Python\anaconda3\condabin\conda.bat"
exit /b 0

:find_conda_env
set "HAS_CONDA_ENV="
set "CONDA_PREFIX_PATH="

if /i "%CONDA_DEFAULT_ENV%"=="%CONDA_ENV%" (
  if exist "%CONDA_PREFIX%\python.exe" (
    set "CONDA_PREFIX_PATH=%CONDA_PREFIX%"
    set "HAS_CONDA_ENV=1"
    exit /b 0
  )
)

for %%D in (
  "%USERPROFILE%\.conda\envs\%CONDA_ENV%"
  "%USERPROFILE%\miniconda3\envs\%CONDA_ENV%"
  "%USERPROFILE%\anaconda3\envs\%CONDA_ENV%"
  "C:\ProgramData\miniconda3\envs\%CONDA_ENV%"
  "C:\ProgramData\anaconda3\envs\%CONDA_ENV%"
  "C:\Python\anaconda3\envs\%CONDA_ENV%"
) do (
  if exist "%%~D\python.exe" (
    set "CONDA_PREFIX_PATH=%%~D"
    set "HAS_CONDA_ENV=1"
    exit /b 0
  )
)

if defined CONDA_CMD (
  for /f "tokens=1,*" %%A in ('call "%CONDA_CMD%" env list ^| findstr /R /C:"^%CONDA_ENV% " 2^>nul') do (
    if exist "%%B\python.exe" (
      set "CONDA_PREFIX_PATH=%%B"
      set "HAS_CONDA_ENV=1"
      exit /b 0
    )
  )
)
exit /b 0

:setup_failed
echo.
echo Failed to create the conda development environment.
echo Run scripts\setup-dev.bat manually to see details.
echo.
pause
exit /b 1

:missing_python
echo Python 3 was not found.
echo Run scripts\setup-dev.bat to create the conda dev environment.
echo Or set SUNNY_TOWN_PYTHON in .env.
echo.
pause
exit /b 1

:missing_npm
echo npm was not found.
echo Run scripts\setup-dev.bat to create the conda dev environment.
echo.
pause
exit /b 1

:install_failed
echo.
echo npm install failed. Please check your network or npm setup.
echo.
pause
exit /b 1
