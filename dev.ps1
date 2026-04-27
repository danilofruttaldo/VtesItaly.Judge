# Dev server manager for vtesItaly.Judge (static site)

$ProjectDir = $PSScriptRoot
$Port = 8766
$DevProcess = $null

function Start-Dev {
    Write-Host "Starting static server on port $Port..." -ForegroundColor Cyan
    $proc = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectDir'; python -m http.server $Port" -PassThru
    return $proc
}

function Stop-ProcessSafe {
    param($proc)
    if ($proc -and -not $proc.HasExited) {
        Write-Host "Stopping process $($proc.Id)..." -ForegroundColor Yellow
        taskkill /T /F /PID $proc.Id 2>$null | Out-Null
    }
}

$DevProcess = Start-Dev
Start-Sleep -Seconds 1

while ($true) {
    Clear-Host
    Write-Host "==========================================" -ForegroundColor Magenta
    Write-Host "   VTES Italy Judge - Dev" -ForegroundColor Magenta
    Write-Host "==========================================" -ForegroundColor Magenta

    $running = $DevProcess -and -not $DevProcess.HasExited
    $status = if ($running) { "RUNNING ($($DevProcess.Id))" } else { "STOPPED" }
    Write-Host "Server: $status" -ForegroundColor $(if ($running) { "Green" } else { "Red" })
    Write-Host "URL:    http://localhost:$Port" -ForegroundColor Cyan
    Write-Host "------------------------------------------"

    Write-Host "Choose an action:" -ForegroundColor Yellow
    if ($running) {
        Write-Host " [R] Restart"
        Write-Host " [A] Stop"
    } else {
        Write-Host " [S] Start"
    }
    Write-Host " [Q] Quit"
    Write-Host ""
    Write-Host "Press a key..." -NoNewline

    $key = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown").Character.ToString().ToUpper()
    Write-Host ""

    switch ($key) {
        "R" {
            if ($running) {
                Stop-ProcessSafe $DevProcess
                Start-Sleep -Seconds 1
                $DevProcess = Start-Dev
            }
        }
        "A" {
            if ($running) {
                Stop-ProcessSafe $DevProcess
                Write-Host "Server stopped." -ForegroundColor Green
                Start-Sleep -Seconds 1
            }
        }
        "S" {
            if (-not $running) {
                $DevProcess = Start-Dev
            }
        }
        "Q" {
            Write-Host "Shutting down..." -ForegroundColor Cyan
            Stop-ProcessSafe $DevProcess
            exit 0
        }
    }

    Start-Sleep -Milliseconds 500
}
