@echo off
cd /d "%~dp0"
set "IMMUNOSTUDIO_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "IMMUNOSTUDIO_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist dist\index.html (
  "%IMMUNOSTUDIO_NODE%" node_modules\vite\bin\vite.js build
  if errorlevel 1 exit /b 1
)
curl.exe --noproxy "*" --max-time 2 --fail --silent http://127.0.0.1:5180/api/status >nul 2>nul
if not errorlevel 1 (
  start "" http://127.0.0.1:5180/
  exit /b 0
)
start "" http://127.0.0.1:5180/
"%IMMUNOSTUDIO_NODE%" scripts\server.mjs
pause
