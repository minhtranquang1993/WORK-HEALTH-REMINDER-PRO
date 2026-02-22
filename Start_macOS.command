#!/bin/bash
# Work Health Reminder PRO - macOS Launcher
# Double-click file này để chạy app!

cd "$(dirname "$0")"

echo "🏃 Work Health Reminder PRO"
echo "================================"

# Kiểm tra Python3
if ! command -v python3 &> /dev/null; then
    osascript -e 'display alert "Cần cài Python 3" message "Vào https://python.org để tải về nhé!" as critical'
    exit 1
fi

# Kiểm tra và cài rumps nếu chưa có
if ! python3 -c "import rumps" 2>/dev/null; then
    echo "📦 Đang cài thư viện rumps..."
    osascript -e 'display notification "Đang cài thư viện, chờ chút..." with title "Work Health Reminder"'
    pip3 install rumps --quiet
    if [ $? -ne 0 ]; then
        osascript -e 'display alert "Cài đặt thất bại" message "Thử chạy lệnh này trong Terminal:\n\npip3 install rumps" as critical'
        exit 1
    fi
fi

echo "✅ Đang khởi động app..."
python3 menubar_app.py
