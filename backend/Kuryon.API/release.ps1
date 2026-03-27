Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Step {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Fail {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    Write-Error $Message
    exit 1
}

function Invoke-StepCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Command,
        [Parameter(Mandatory = $true)]
        [string]$FailureMessage
    )

    Write-Host "PS> $Command" -ForegroundColor DarkGray
    Invoke-Expression $Command
    if ($LASTEXITCODE -ne 0) {
        Fail "$FailureMessage (exit code: $LASTEXITCODE)"
    }
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendRoot = $scriptRoot
$frontendRoot = Join-Path (Split-Path -Parent $backendRoot) "kuryon-panel"
$backendPublishDir = Join-Path $backendRoot "publish\backend"
$frontendDistRoot = Join-Path $frontendRoot "dist\kuryon-panel"
$frontendBrowserDir = Join-Path $frontendDistRoot "browser"

if (-not (Test-Path -Path $backendRoot -PathType Container)) {
    Fail "Backend root not found: $backendRoot"
}

if (-not (Test-Path -Path $frontendRoot -PathType Container)) {
    Fail "Frontend root not found: $frontendRoot. Beklenen klasor: ../kuryon-panel"
}

try {
    Step "Backend release build + publish"
    Push-Location $backendRoot

    Invoke-StepCommand -Command "dotnet restore" -FailureMessage "dotnet restore failed"
    Invoke-StepCommand -Command "dotnet build -c Release" -FailureMessage "dotnet build (Release) failed"
    Invoke-StepCommand -Command "dotnet publish -c Release -o .\publish\backend" -FailureMessage "dotnet publish failed"

    Pop-Location

    Step "Frontend production build"
    Push-Location $frontendRoot

    Invoke-StepCommand -Command "npm install" -FailureMessage "npm install failed"
    Invoke-StepCommand -Command "npm run build -- --configuration production" -FailureMessage "npm production build failed"

    Pop-Location

    Step "Output validation"

    if (-not (Test-Path -Path $backendPublishDir -PathType Container)) {
        Fail "Backend publish folder not found: $backendPublishDir"
    }

    $backendWebConfig = Join-Path $backendPublishDir "web.config"
    if (-not (Test-Path -Path $backendWebConfig -PathType Leaf)) {
        Fail "Backend publish output missing web.config: $backendWebConfig"
    }

    if (-not (Test-Path -Path $frontendDistRoot -PathType Container)) {
        Fail "Frontend dist folder not found: $frontendDistRoot"
    }

    $frontendWebConfig = Join-Path $frontendBrowserDir "web.config"
    if (-not (Test-Path -Path $frontendWebConfig -PathType Leaf)) {
        Fail "Frontend dist missing web.config: $frontendWebConfig"
    }

    $frontendRuntimeConfig = Join-Path $frontendBrowserDir "runtime-config.js"
    if (-not (Test-Path -Path $frontendRuntimeConfig -PathType Leaf)) {
        Fail "Frontend dist missing runtime-config.js: $frontendRuntimeConfig"
    }

    Write-Host ""
    Write-Host "Release build completed successfully." -ForegroundColor Green
    Write-Host "Backend publish folder : $backendPublishDir"
    Write-Host "Frontend dist folder   : $frontendBrowserDir"
    Write-Host ""
    Write-Host "Next manual steps:" -ForegroundColor Yellow
    Write-Host "1) appsettings.Production.json placeholder alanlarini production degerleriyle doldur."
    Write-Host "2) Frontend runtime-config.js ve gerekiyorsa environment.prod.ts API URL alanlarini production domain ile guncelle."
    Write-Host "3) SQL Server migration uygula: dotnet ef database update --configuration Release"
    Write-Host "4) Backend publish klasorunu IIS'e deploy et, frontend browser klasorunu statik hosting'e deploy et."
}
catch {
    if (Get-Location) {
        while ((Get-Location).Path -ne $scriptRoot) {
            try {
                Pop-Location
            }
            catch {
                break
            }
        }
    }

    Fail ("Release script failed: " + $_.Exception.Message)
}
