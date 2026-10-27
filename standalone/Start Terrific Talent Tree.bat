@echo off
title Terrific Talent Tree
cd /d "%~dp0desktop"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 18 or newer is required - get it free from https://nodejs.org
  pause
  exit /b 1
)
echo Starting Terrific Talent Tree - it will open in your browser...
node serve.js
pause