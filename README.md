# Fanyun-chat
A light chat app
Connect to people from everywhere.
Free, light, fast

## Tech
- Node.js
- Express
- Socket.IO
- HTML/CSS/JS
- React + Vite

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
