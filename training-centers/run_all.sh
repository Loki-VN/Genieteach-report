#!/usr/bin/env bash
# Chạy toàn bộ pipeline trên máy (macOS/Linux): cài thư viện, chạy mọi nguồn, xuất 1 file Excel.
# Dùng: ./run_all.sh            (chạy tiếp từ checkpoint)
#       ./run_all.sh --refresh  (chạy lại từ đầu)
set -euo pipefail
cd "$(dirname "$0")"
[ -d .venv ] || python3 -m venv .venv
. .venv/bin/activate
pip install -q -r requirements.txt
export PYTHONUTF8=1
python -m tcpipe init-db
python -m tcpipe run-all "$@"
