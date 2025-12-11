@echo off
echo Starting Frontend Server on port 8080...
cd /d %~dp0
python -m http.server 8080
pause

