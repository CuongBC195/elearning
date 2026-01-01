# AI Writing Editor

Ứng dụng AI Writing Editor giúp người dùng luyện tập dịch và viết tiếng Anh với sự hỗ trợ của Google Gemini AI.

## Tính năng

- ✨ Focus Mode: Tự động làm mờ các phần không đang chỉnh sửa
- ✅ Tick xanh: Đánh dấu hoàn thành khi viết đủ nội dung
- 👻 Ghost Panel: Sidebar tự động làm mờ khi đang tập trung viết
- 🤖 AI Analysis: Phân tích và chấm điểm bài viết bằng Gemini AI
- 🔄 Auto-save: Tự động lưu vào session storage
- 🔑 API Key Fallback: Tự động chuyển đổi API key nếu một key không hoạt động

## Cấu trúc dự án

```
my-ai-writing-app/
├── app/
│   ├── api/
│   │   └── analyze/
│   │       └── route.ts      # Logic xử lý AI (Gemini API)
│   ├── globals.css           # Tailwind CSS & Custom styles
│   ├── layout.tsx            # Font Inter & Material Symbols
│   └── page.tsx              # Giao diện chính
├── components/
│   └── EssayEditor.tsx       # Component logic xử lý chính
├── constants/
│   └── prompts.ts            # Nơi lưu trữ toàn bộ Prompt Engineering
├── types/
│   └── index.ts              # Định nghĩa dữ liệu bài viết
├── .env.local                # API Keys (KHÔNG commit lên git)
└── .gitignore               # Bảo vệ .env.local
```

## Cài đặt

1. Cài đặt dependencies:
```bash
npm install
```

2. Tạo file `.env.local` (đã có sẵn trong project):
```env
GEMINI_API_KEY_1=your_api_key_1_here
GEMINI_API_KEY_2=your_api_key_2_here
GEMINI_API_KEY_3=your_api_key_3_here
```

3. Chạy development server:
```bash
npm run dev
```

4. Mở [http://localhost:3000](http://localhost:3000) trong trình duyệt.

## Bảo mật API Keys

- ✅ File `.env.local` đã được thêm vào `.gitignore`
- ✅ Không commit API keys lên GitHub
- ✅ Sử dụng environment variables
- ✅ Hỗ trợ 3 API keys với cơ chế fallback tự động

## Công nghệ sử dụng

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Google Gemini AI** - AI analysis
- **Material Symbols** - Icons

## Lưu ý

- Đảm bảo bạn có API keys hợp lệ từ Google AI Studio
- API route sẽ tự động thử các API keys theo thứ tự nếu một key không hoạt động
- Dữ liệu được lưu vào session storage (sẽ mất khi đóng tab)

