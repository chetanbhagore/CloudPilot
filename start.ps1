# CloudPilot - Dual Mode Engine Launcher (PowerShell)
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "     CloudPilot - Starting Presentation Stack           " -ForegroundColor Green
Write-Host "     TECHyug 2K26 National Cloud Competition            " -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/2] Starting Python FastAPI Backend on http://localhost:8000 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "python backend/run.py"

Start-Sleep -Seconds 2

Write-Host "[2/2] Starting React Vite Frontend on http://localhost:5173 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev"

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "  Stack launched successfully!                          " -ForegroundColor Green
Write-Host "  Frontend : http://localhost:5173                      " -ForegroundColor White
Write-Host "  Backend  : http://localhost:8000 (Docs: /docs)        " -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Green
