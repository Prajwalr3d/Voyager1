param(
    [int]$Port = 8011
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

$Python = Join-Path $ProjectRoot ".venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $Python)) {
    Write-Host "ERROR: Project virtual-environment Python not found:" -ForegroundColor Red
    Write-Host $Python
    Write-Host "Create the environment first with: python -m venv .venv"
    exit 1
}

$Listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1

if ($Listener) {
    $ProcessId = $Listener.OwningProcess
    $ProcessInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue

    Write-Host "ERROR: Port $Port is already occupied." -ForegroundColor Red
    Write-Host "Listener PID: $ProcessId"

    if ($ProcessInfo) {
        Write-Host "Executable: $($ProcessInfo.ExecutablePath)"
        Write-Host "Command: $($ProcessInfo.CommandLine)"
    }

    Write-Host "" 
    Write-Host "Verify the listener before stopping it."
    Write-Host "Use a different port or inspect the existing process."
    exit 1
}

$LogDir = Join-Path $ProjectRoot "tmp"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$StdOutLog = Join-Path $LogDir ("smartchunk-uvicorn-$Port-stdout.log")
$StdErrLog = Join-Path $LogDir ("smartchunk-uvicorn-$Port-stderr.log")

$Arguments = @(
    '-m', 'uvicorn', 'smartchunk.api:app',
    '--host', '127.0.0.1',
    '--port', [string]$Port,
    '--log-level', 'info'
)

Write-Host "Starting SmartChunk..." -ForegroundColor Cyan
Write-Host "Project: $ProjectRoot"
Write-Host "Python:  $Python"
Write-Host "URL:     http://127.0.0.1:$Port/app"
Write-Host "Logs:    $StdOutLog"
Write-Host "         $StdErrLog"
Write-Host ""

$Process = Start-Process -FilePath $Python -ArgumentList $Arguments -WorkingDirectory $ProjectRoot -PassThru -RedirectStandardOutput $StdOutLog -RedirectStandardError $StdErrLog

Start-Sleep -Seconds 2

$Running = $false
if ($Process -and $Process.HasExited -eq $false) {
    $Running = $true
}

if (-not $Running) {
    Write-Host "ERROR: SmartChunk process exited immediately during startup." -ForegroundColor Red
    if (Test-Path -LiteralPath $StdOutLog) { Write-Host "--- stdout ---"; Get-Content -Path $StdOutLog -ErrorAction SilentlyContinue }
    if (Test-Path -LiteralPath $StdErrLog) { Write-Host "--- stderr ---"; Get-Content -Path $StdErrLog -ErrorAction SilentlyContinue }
    exit 1
}

Write-Host "Started PID: $($Process.Id)"
Write-Host "Server is running in the background. Use Ctrl+C only in the terminal that started the process."
