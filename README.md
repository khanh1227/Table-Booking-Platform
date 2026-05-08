# Table-Booking-Platform (v2)

Dự án xây dựng một nền tảng (Platform) đặt bàn nhà hàng toàn diện, hỗ trợ từ khâu tìm kiếm, tư vấn thông minh đến quy trình đặt bàn và thanh toán trực tuyến.

---

## 1. Thành phần hệ thống
Dự án tập trung vào xây dựng nền tảng đặt bàn hoàn chỉnh, bao gồm 2 thành phần chính và 1 thành phần bổ trợ:
- **Backend (`/be` - Chính):** Xây dựng bằng Django Rest Framework, chịu trách nhiệm quản lý toàn bộ dữ liệu, logic nghiệp vụ, thanh toán và bảo mật.
- **Frontend (`/fe` - Chính):** Xây dựng bằng React + Vite, cung cấp giao diện người dùng hiện đại, mượt mà và tối ưu trải nghiệm đặt bàn.
- **AI Chatbot (`/chatbot` - Bổ trợ):** Trợ lý ảo AI hỗ trợ tư vấn tự động. Đây là thành phần mở rộng, có thể sử dụng hoặc không tùy vào nhu cầu cấu hình.

---

## 2. Yêu cầu hệ thống
- **Python**: 3.10+
- **Node.js**: 18+
- **MySQL**: 8.0+
- **OpenAI API Key**: (Tùy chọn - Để dùng tính năng AI)
- **VNPAY Sandbox**: (Tùy chọn - Để dùng tính năng thanh toán)

---

## 3. Hướng dẫn cài đặt chi tiết

### A. Cơ sở dữ liệu (MySQL)
Dự án có kèm theo file **`db.sql`** chứa toàn bộ cấu trúc bảng và dữ liệu mẫu.
1. Tạo một database trong MySQL (ví dụ: `tablebooking_db_new`).
2. Import file `db.sql` vào database vừa tạo.
   *Lưu ý: Nếu dùng cách này, bạn sẽ có sẵn dữ liệu mẫu và có thể bỏ qua bước migration ở phần sau.*

### B. Backend (Django)
1. Di chuyển vào thư mục backend:
   ```bash
   cd be
   ```
2. Tạo môi trường ảo và cài đặt thư viện:
   ```bash
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # Linux/macOS:
   source .venv/bin/activate
   
   pip install -r requirements.txt
   ```
3. Cấu hình môi trường:
   - Copy file `.env.example` thành `.env`.
   - Mở file `.env` và cập nhật thông tin Database (Host, User, Password...).
4. Khởi tạo Database (Nếu không dùng file `db.sql` ở bước A):
   ```bash
   python manage.py migrate
   ```
5. Chạy server:
   ```bash
   python manage.py runserver
   ```
   *Server chạy tại: http://127.0.0.1:8000*

### C. Frontend (React)
1. Di chuyển vào thư mục frontend:
   ```bash
   cd fe
   ```
2. Cài đặt và chạy:
   ```bash
   npm install
   npm run dev
   ```
   *Giao diện chạy tại: http://localhost:5173*

### D. AI Chatbot (Mở rộng - Tùy chọn)
1. Di chuyển vào thư mục chatbot:
   ```bash
   cd chatbot
   ```
2. Tạo môi trường ảo và cài đặt thư viện:
   ```bash
   python -m venv .venv
   .venv\Scripts\activate
   pip install -r requirements.txt
   ```
3. Cấu hình môi trường:
   - Copy file `.env.example` thành `.env`.
   - Cập nhật thông tin kết nối Database và API Key bên trong file `.env`.
4. Chạy service:
   ```bash
   uvicorn main:app --port 8001 --reload
   ```
   *Service chạy tại: http://127.0.0.1:8001*

---
