@echo off
REM Chay toan bo pipeline tren Windows: cai thu vien, chay moi nguon, xuat 1 file Excel.
REM Dung: run_all.bat            (chay tiep tu checkpoint)
REM       run_all.bat --refresh  (chay lai tu dau)
cd /d "%~dp0"
set PYTHONUTF8=1
if not exist .venv (py -3 -m venv .venv)
call .venv\Scripts\activate.bat
pip install -q -r requirements.txt
python -m tcpipe init-db
python -m tcpipe run-all %*
pause
