# Chỉ dẫn cho Gemini Code Assist

## Giới thiệu
- Tên ứng dụng: Fanyun-chat
- Tính năng: Nhắn tin và gọi điện với bạn bè, xem các bài viết của bạn bè, tạo bài viết của riêng mình. Có trạng thái hoạt động, cá nhân hóa profile.
- Mục đích: Một "facebook" dùng trong mạng lưới nội bộ trường học.

## Công nghệ chủ chốt
- Node.js
- Express
- Socket.IO
- HTML/CSS/JS
- React + Vite
- PostgreSQL
- Deploy: Railway(Backend) + Vercel(Frontend)

## Run local
Một app hoàn chỉnh cần hai process riêng biệt cho client và server

Đầu tiên mở một terminal rồi tạo server:
```bash
cd server
npm install
node index.js
```
Sau đó mở một terminal rồi tạo code xử lý phần client
```bash
cd fanyun-chat-react
npm install
npm run dev
```
Nếu bạn update code trong thư mục fanyun-chat-react(phần client) thì web sẽ được tự động cập nhật

Còn nếu bạn update code trong thư mục server(phần server) thì ở terminal chạy server bạn cần reset lại server(Ctrl + C để hủy rồi chạy lại lệnh node index.js), phần client sẽ tự động cập nhật.

## Quy tắc viết code
- Luôn sử dụng Functional Components và Hooks.
- Đặt tên file component theo định dạng `PascalCase.tsx`.
- Tất cả các API call có dạng app.post/get '/api/<api_name>'.

## Lưu ý đặc biệt
- Dự án này ưu tiên hiệu năng (Performance), hạn chế re-render không cần thiết.
- Ngôn ngữ chủ đạo là English