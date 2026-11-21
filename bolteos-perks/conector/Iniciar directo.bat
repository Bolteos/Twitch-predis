@echo off
cd /d "%~dp0"
where py >nul 2>&1
if errorlevel 1 (
  python conector.py
) else (
  py -3 conector.py
)
if errorlevel 1 pause
