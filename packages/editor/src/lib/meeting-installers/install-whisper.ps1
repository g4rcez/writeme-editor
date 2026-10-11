$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
$revision = 'd1be6fde11ac6e0407606b4e42fe72d34add8037'
$modelHash = '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe'
$installDir = if ($env:WRITEME_WHISPER_DIR) { $env:WRITEME_WHISPER_DIR } else { Join-Path $env:LOCALAPPDATA 'Writeme\whisper' }

function Refresh-Path {
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User') + ';' + $env:Path + ';' + (Join-Path $env:ProgramFiles 'CMake\bin') + ';' + (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links')
}

function Install-Package([string] $id, [string[]] $extra = @()) {
    & winget install --id $id --exact --source winget --accept-package-agreements --accept-source-agreements @extra
    if ($LASTEXITCODE -ne 0) { throw "Installation of $id failed ($LASTEXITCODE). Rerun this script after resolving the error above." }
    Refresh-Path
}

try {
    Refresh-Path
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw 'Windows App Installer (winget) is required. Install it from Microsoft Store, then rerun this script.'
    }
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    if ($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Run this script in a regular PowerShell window. Dependency installers will request permission when needed.'
    }
    if (-not (Get-Command cmake -ErrorAction SilentlyContinue)) { Install-Package 'Kitware.CMake' }
    if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) { Install-Package 'Gyan.FFmpeg' }
    $vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
    $vsPath = if (Test-Path $vswhere) { & $vswhere -latest -products '*' -version '[17.0,18.0)' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath } else { $null }
    if (-not $vsPath) {
        $existing = if (Test-Path $vswhere) { & $vswhere -latest -products Microsoft.VisualStudio.Product.BuildTools -version '[17.0,18.0)' -property installationPath } else { $null }
        if ($existing) {
            $setup = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\setup.exe'
            $modify = Start-Process -FilePath $setup -ArgumentList @('modify', '--installPath', "`"$existing`"", '--passive', '--norestart', '--add', 'Microsoft.VisualStudio.Workload.VCTools', '--includeRecommended') -Verb RunAs -Wait -PassThru
            if ($modify.ExitCode -eq 3010) { throw 'Build tools require a restart. Restart Windows and rerun this script.' }
            if ($modify.ExitCode -ne 0) { throw "C++ build tools installation failed ($($modify.ExitCode))." }
        } else {
            Install-Package 'Microsoft.VisualStudio.2022.BuildTools' @('--override', '--wait --passive --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended')
        }
        $vsPath = & $vswhere -latest -products '*' -version '[17.0,18.0)' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
        if (-not $vsPath) { throw 'C++ build tools are unavailable. Restart Windows if requested, then rerun this script.' }
    }
    if (-not (Get-Command cmake -ErrorAction SilentlyContinue)) { throw 'CMake is unavailable. Open a new PowerShell window and rerun this script.' }
    if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) { throw 'FFmpeg is unavailable. Open a new PowerShell window and rerun this script.' }

    Write-Host "Installing local transcription in $installDir"
    New-Item -ItemType Directory -Force -Path $installDir | Out-Null
    $sourceDir = Join-Path $installDir "whisper.cpp-$revision"
    $marker = Join-Path $sourceDir '.source-ready'
    if (-not (Test-Path $marker)) {
        $archive = Join-Path $installDir 'source.zip'
        Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/ggml-org/whisper.cpp/archive/$revision.zip" -OutFile $archive
        Expand-Archive -Path $archive -DestinationPath $installDir -Force
        New-Item -ItemType File -Force -Path $marker | Out-Null
    }
    $buildDir = Join-Path $sourceDir 'build'
    & cmake -S $sourceDir -B $buildDir -G 'Visual Studio 17 2022' -A x64 '-DWHISPER_BUILD_SERVER=ON' '-DGGML_NATIVE=OFF'
    if ($LASTEXITCODE -ne 0) { throw 'Whisper configuration failed.' }
    & cmake --build $buildDir --config Release --target whisper-server --parallel 4
    if ($LASTEXITCODE -ne 0) { throw 'Whisper build failed.' }

    $model = Join-Path $sourceDir 'models\ggml-base.bin'
    if (-not (Test-Path $model) -or (Get-FileHash $model -Algorithm SHA256).Hash -ne $modelHash) {
        $partial = "$model.part"
        Invoke-WebRequest -UseBasicParsing -Uri 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin' -OutFile $partial
        if ((Get-FileHash $partial -Algorithm SHA256).Hash -ne $modelHash) { throw 'Model checksum verification failed. Rerun this script to retry.' }
        Move-Item -Path $partial -Destination $model -Force
    }
    $launcher = Join-Path $installDir 'start-whisper.ps1'
    $quotedSource = $sourceDir.Replace("'", "''")
    @(
        '$ErrorActionPreference = ''Stop''',
        "Set-Location -LiteralPath '$quotedSource'",
        '& ./build/bin/Release/whisper-server.exe --model models/ggml-base.bin --threads 4 --host 127.0.0.1 --port 8080 --convert --language auto',
        'exit $LASTEXITCODE'
    ) | Set-Content -Path $launcher -Encoding UTF8
    Write-Host "Starting local transcription at http://localhost:8080/inference. Keep this window open; press Ctrl+C to stop."
    Write-Host "To start again: powershell -NoProfile -ExecutionPolicy Bypass -File `"$launcher`""
    & $launcher
    exit $LASTEXITCODE
} catch {
    Write-Error "Installation stopped: $_"
    exit 1
}
