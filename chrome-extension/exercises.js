// ========================================
// Work Health Reminder - Exercise Data
// ========================================

const EXERCISES = {
    neck: {
        title: "🧘 Bài tập giãn cơ cổ",
        duration: "2 phút",
        content: `
1️⃣ Nghiêng đầu sang trái
   → Giữ 15 giây, hít thở đều

2️⃣ Nghiêng đầu sang phải
   → Giữ 15 giây, hít thở đều

3️⃣ Cúi đầu về phía trước
   → Giữ 15 giây, cảm nhận sau cổ giãn

4️⃣ Ngửa đầu ra sau nhẹ nhàng
   → Giữ 10 giây, không quá căng

5️⃣ Xoay cổ chậm theo vòng tròn
   → 5 vòng theo chiều kim đồng hồ
   → 5 vòng ngược chiều`
    },
    
    shoulder: {
        title: "💪 Bài tập giãn vai",
        duration: "2 phút",
        content: `
1️⃣ Nhún vai lên xuống
   → Nâng vai lên cao, giữ 5 giây
   → Thả xuống, lặp 10 lần

2️⃣ Xoay vai
   → 10 vòng ra trước
   → 10 vòng ra sau

3️⃣ Căng tay qua ngực
   → Tay phải đưa qua ngực trái
   → Giữ 15 giây, đổi bên

4️⃣ Chắp tay sau lưng
   → Đan các ngón tay sau lưng
   → Ưỡn ngực, giữ 15 giây`
    },
    
    eye: {
        title: "👁️ Bài tập mắt",
        duration: "2 phút",
        content: `
1️⃣ Chớp mắt nhanh
   → Chớp mắt 20 lần liên tục
   → Giúp làm ẩm mắt

2️⃣ Nhìn xa - gần
   → Nhìn vào ngón tay cách 30cm
   → Chuyển sang nhìn vật xa (cửa sổ)
   → Lặp lại 10 lần

3️⃣ Xoay mắt
   → Xoay mắt theo hình số 8
   → 5 lần theo chiều kim đồng hồ
   → 5 lần ngược chiều

4️⃣ Che mắt (Palming)
   → Xoa hai lòng bàn tay cho ấm
   → Áp nhẹ lên mắt đang nhắm
   → Giữ 30 giây, thư giãn`
    },
    
    breathing: {
        title: "🌬️ Bài tập hít thở",
        duration: "2 phút",
        content: `
1️⃣ Hít thở 4-7-8
   → Hít vào bằng mũi 4 giây
   → Giữ hơi 7 giây
   → Thở ra bằng miệng 8 giây
   → Lặp lại 4 lần

2️⃣ Hít thở bụng
   → Đặt tay lên bụng
   → Hít vào, bụng phồng lên
   → Thở ra, bụng xẹp xuống
   → Lặp 10 lần, chậm rãi

💡 Tip: Tưởng tượng bạn đang ở nơi
   yên tĩnh, thư thái...`
    },
    
    rule_20_20_20: {
        title: "👁️ Quy tắc 20-20-20",
        duration: "20 giây",
        content: `
Mỗi 20 phút làm việc máy tính:
→ Nhìn ra xa 20 feet (khoảng 6 mét)
→ Trong 20 giây

🎯 Mục đích:
• Giảm mỏi mắt
• Ngăn ngừa khô mắt
• Bảo vệ thị lực lâu dài

💡 Tip: Nhìn ra cửa sổ hoặc
   vật xa nhất trong phòng!`
    },
    
    posture: {
        title: "🪑 Kiểm tra tư thế ngồi",
        duration: "30 giây",
        content: `
✅ Checklist:
□ Lưng thẳng, tựa vào ghế
□ Vai thả lỏng, không nhún
□ Khuỷu tay vuông 90°
□ Chân chạm đất hoặc có kê chân
□ Màn hình ngang tầm mắt
□ Mắt cách màn hình 50-70cm

⚠️ Tránh:
✗ Cúi đầu về phía trước
✗ Gù lưng
✗ Vắt chân qua nhau lâu`
    },
    
    blink: {
        title: "😊 Nhắc chớp mắt",
        duration: "30 giây",
        content: `
Khi tập trung vào màn hình,
chúng ta thường quên chớp mắt!

→ Chớp mắt 15-20 lần ngay bây giờ
→ Mỗi lần chớp, giữ nhắm 1 giây

💡 Điều này giúp:
• Làm ẩm mắt
• Giảm khô và mỏi mắt
• Bảo vệ giác mạc`
    },
    
    stand_up: {
        title: "🚶 Đứng dậy đi bộ",
        duration: "3 phút",
        content: `
Đã ngồi lâu rồi! Hãy:

1. Đứng dậy, duỗi tay lên cao
2. Đi bộ vài bước (lấy nước, toilet)
3. Hoặc đứng tại chỗ, nhấc gót chân

⏱️ Chỉ cần 2-3 phút!

💡 Lợi ích:
• Tăng lưu thông máu
• Giảm đau lưng, mỏi chân
• Tăng năng suất làm việc`
    }
};

// Reminder messages
const REMINDERS = {
    walk: {
        icon: "🚶",
        title: "Đến lúc đi bộ rồi!",
        message: "Đứng dậy và đi bộ 2-3 phút để thư giãn cơ thể nhé! 🏃‍♂️"
    },
    water: {
        icon: "💧",
        title: "Uống nước đi!",
        message: "Uống một ly nước lọc để giữ cơ thể luôn được hydrate nhé! 💦"
    },
    toilet: {
        icon: "🚻",
        title: "Đi toilet thôi!",
        message: "Đến lúc đi toilet rồi, đừng nhịn quá lâu nhé! 🚽"
    },
    eye_20_20_20: {
        icon: "👁️",
        title: "20-20-20!",
        message: "Nhìn ra xa 6 mét trong 20 giây để bảo vệ mắt!"
    },
    posture: {
        icon: "🪑",
        title: "Kiểm tra tư thế!",
        message: "Ngồi thẳng lưng, thả lỏng vai, chân chạm đất nhé!"
    },
    neck_stretch: {
        icon: "🧘",
        title: "Giãn cổ vai!",
        message: "Dành 2 phút để giãn cơ cổ và vai nhé!"
    },
    lunch: {
        icon: "🍱",
        title: "Đến giờ lấy phiếu cơm!",
        message: "Đi lấy phiếu ăn cơm trưa và nghỉ ngơi nhé! Chúc ngon miệng! 🥢"
    },
    end_work: {
        icon: "🏠",
        title: "Hết giờ làm việc!",
        message: "Đã 17:30! Chuẩn bị về nhà hoặc đón người yêu thôi! 💕"
    }
};
