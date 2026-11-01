@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 24 or later is required. Install it from nodejs.org, then try again.
  pause
  exit /b 1
)
echo Starting Pearl Atelier. Keep this window open.
echo Shop: http://127.0.0.1:4173
echo Admin: http://127.0.0.1:4173/admin
node server.mjs
if errorlevel 1 (
  echo If the port is already in use, open the address above: the demo may already be running.
  pause
)
