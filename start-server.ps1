Write-Host "Starting Frontend Server on port 8080..." -ForegroundColor Green
Set-Location $PSScriptRoot

# Try Python first
try {
    python -m http.server 8080
} catch {
    Write-Host "Python not found, trying npx serve..." -ForegroundColor Yellow
    try {
        npx --yes serve -l 8080
    } catch {
        Write-Host "Error: Could not start server. Please install Python or Node.js" -ForegroundColor Red
        Read-Host "Press Enter to exit"
    }
}

