#!/bin/bash
# Nhấp đúp file này để chạy server trên Mac
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Chưa cài Node.js. Tải tại https://nodejs.org (bản LTS), cài xong mở lại file này."
  read -p "Nhấn Enter để đóng..."
  exit 1
fi
[ -d node_modules ] || npm install
npm start
