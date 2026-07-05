@echo off
rem GroupPulse live demo — start local server and open browser
cd /d "%~dp0"
start "" http://localhost:8765
node server.js
