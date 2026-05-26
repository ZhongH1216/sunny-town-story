$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$EnvName = "sunny-town-dev"

Set-Location $Root

Write-Host ""
Write-Host "Setting up Sunny Town Story development environment..."
Write-Host ""

$conda = Get-Command conda -ErrorAction SilentlyContinue
if (-not $conda) {
  throw "conda was not found. Install Anaconda or Miniconda first."
}

$envList = conda env list
$exists = $envList -match "^\s*$EnvName\s+"

if ($exists) {
  Write-Host "Updating conda environment $EnvName..."
  conda env update -n $EnvName -f environment.yml --prune
} else {
  Write-Host "Creating conda environment $EnvName..."
  conda env create -f environment.yml
}

Write-Host ""
Write-Host "Installing npm dependencies..."
conda run -n $EnvName npm install

Write-Host ""
Write-Host "Installing Playwright Chromium..."
if ($args -contains "--skip-browsers") {
  Write-Host "Skipping Playwright browser install."
} else {
  conda run -n $EnvName npm run install:browsers
}

Write-Host ""
Write-Host "Environment is ready."
Write-Host "Use:"
Write-Host "  conda activate $EnvName"
Write-Host "  npm run check"
Write-Host "  npm test"
Write-Host "  npm run serve"
