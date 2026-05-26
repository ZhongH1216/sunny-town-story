@echo off
setlocal

set "ROOT=%~dp0.."
set "ENV_NAME=sunny-town-dev"

cd /d "%ROOT%"

echo.
echo Setting up Sunny Town Story development environment...
echo.

where conda >nul 2>nul
if errorlevel 1 goto missing_conda

call conda env list | findstr /R /C:"^%ENV_NAME% " >nul 2>nul
if errorlevel 1 (
  echo Creating conda environment %ENV_NAME%...
  call conda env create -f environment.yml
  if errorlevel 1 goto conda_failed
) else (
  echo Updating conda environment %ENV_NAME%...
  call conda env update -n %ENV_NAME% -f environment.yml --prune
  if errorlevel 1 goto conda_failed
)

echo.
echo Installing npm dependencies...
call conda run -n %ENV_NAME% npm install
if errorlevel 1 goto npm_failed

echo.
echo Installing Playwright Chromium...
if /i "%1"=="--skip-browsers" (
  echo Skipping Playwright browser install.
) else (
  call conda run -n %ENV_NAME% npm run install:browsers
  if errorlevel 1 goto playwright_failed
)

echo.
echo Environment is ready.
echo Use:
echo   conda activate %ENV_NAME%
echo   npm run check
echo   npm test
echo   npm run serve
echo.
exit /b 0

:missing_conda
echo conda was not found. Install Anaconda or Miniconda first.
exit /b 1

:conda_failed
echo Conda environment setup failed.
exit /b 1

:npm_failed
echo npm install failed.
exit /b 1

:playwright_failed
echo Playwright browser install failed.
echo You can retry later with: conda run -n %ENV_NAME% npm run install:browsers
exit /b 1
