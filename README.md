# DocBot - Smart Document Assistant

DocBot là một ứng dụng chat thông minh cho phép bạn upload tài liệu và đặt câu hỏi về nội dung của chúng. Ứng dụng sử dụng AI để phân tích và trả lời các câu hỏi dựa trên nội dung tài liệu.

## Tính năng chính

### 🔐 Xác thực người dùng
- Đăng ký tài khoản mới
- Đăng nhập/đăng xuất
- Xác thực email
- Đặt lại mật khẩu
- Chế độ khách (guest mode)

### 📄 Quản lý tài liệu
- Upload nhiều loại file: PDF, DOC, DOCX, TXT, MD, RTF, ODT
- Drag & drop để upload file
- Xem và xóa file đã upload
- Tự động tạo FAISS index cho tìm kiếm

### 💬 Chat thông minh
- Đặt câu hỏi về nội dung tài liệu
- Trả lời dựa trên AI (Groq API)
- Tìm kiếm semantic trong tài liệu
- Lưu lịch sử chat

### 🎨 Giao diện người dùng
- Thiết kế hiện đại, responsive
- Chế độ sáng/tối
- Loading states và error handling
- Giao diện thân thiện với người dùng

## Cấu trúc dự án

```
DocBot/
├── client/                 # Frontend (HTML, CSS, JS)
│   ├── app/               # Ứng dụng chính
│   ├── login/             # Trang đăng nhập
│   └── shared/            # API client chung
├── server/                # Backend (Python FastAPI)
│   ├── controllers/       # Controllers
│   ├── models/           # Database models
│   ├── routes/           # API routes
│   ├── services/         # Business logic
│   └── database/         # Database schema
├── certs/                # SSL certificates
└── https-server.js       # HTTPS server
```

## Cài đặt và chạy

### Yêu cầu hệ thống
- Node.js 16+
- Python 3.8+
- Supabase account
- Groq API key

### Backend Setup

1. Cài đặt dependencies:
```bash
pip install -r requirement.txt
```

2. Cấu hình environment variables:
```bash
cp server/.env.example server/.env
# Chỉnh sửa file .env với thông tin của bạn
```

3. Chạy server:
```bash
cd server
python server.py
```

### Frontend Setup

1. Cài đặt dependencies:
```bash
npm install
```

2. Chạy HTTPS server:
```bash
node https-server.js
```

3. Truy cập ứng dụng tại: `https://localhost:5501`

## API Endpoints

### Authentication
- `POST /user/register` - Đăng ký
- `POST /user/login` - Đăng nhập
- `POST /user/logout` - Đăng xuất
- `POST /user/verify` - Xác thực email
- `POST /user/forgot-password` - Quên mật khẩu

### Chat
- `GET /chat/user/` - Lấy danh sách chat của user
- `POST /chat/create` - Tạo chat mới
- `GET /chat/session/{id}` - Lấy thông tin session
- `GET /chat/session/{id}/messages` - Lấy messages
- `GET /chat/session/{id}/files` - Lấy files
- `POST /chat/session/{id}/upload` - Upload file
- `POST /chat/session/{id}/process` - Xử lý message
- `PUT /chat/session/{id}/rename` - Đổi tên chat
- `DELETE /chat/session/{id}` - Xóa chat

## Công nghệ sử dụng

### Frontend
- HTML5, CSS3, JavaScript ES6+
- Font Awesome icons
- Bootstrap 5
- Responsive design

### Backend
- Python 3.8+
- FastAPI
- Supabase (PostgreSQL)
- Sentence Transformers
- Groq API
- FAISS (vector search)

### AI/ML
- Sentence Transformers (all-MiniLM-L6-v2)
- FAISS vector database
- Groq API (GPT-OSS-120B)

## Tính năng nâng cao

### Vector Search
- Tự động tạo embeddings cho tài liệu
- Chia nhỏ tài liệu thành chunks
- Tìm kiếm semantic similarity
- Trả lời dựa trên context liên quan

### Error Handling
- Xử lý lỗi upload file
- Retry mechanism
- User-friendly error messages
- Graceful degradation

### Performance
- Lazy loading
- Caching
- Optimized queries
- Background processing

## Hướng dẫn sử dụng

1. **Đăng ký/Đăng nhập**: Tạo tài khoản hoặc đăng nhập
2. **Upload tài liệu**: Kéo thả hoặc click để chọn file
3. **Đặt câu hỏi**: Nhập câu hỏi về nội dung tài liệu
4. **Xem kết quả**: AI sẽ trả lời dựa trên nội dung tài liệu
5. **Quản lý chat**: Lưu, đổi tên, xóa các cuộc trò chuyện

## Troubleshooting

### Lỗi thường gặp
- **Upload failed**: Kiểm tra kết nối mạng và kích thước file
- **API error**: Kiểm tra API keys và server status
- **Login failed**: Kiểm tra email/password và xác thực email

### Debug
- Mở Developer Tools (F12)
- Kiểm tra Console tab để xem lỗi
- Kiểm tra Network tab để xem API calls

## Đóng góp

1. Fork repository
2. Tạo feature branch
3. Commit changes
4. Push to branch
5. Tạo Pull Request

## License

MIT License - xem file LICENSE để biết thêm chi tiết.

## Liên hệ

Nếu có câu hỏi hoặc góp ý, vui lòng tạo issue trên GitHub.
