# Vercel Deployment Setup Guide

## Environment Variables

Khi deploy lên Vercel, bạn cần thêm các environment variables sau trong Vercel Dashboard:

### 1. Truy cập Vercel Dashboard
- Đăng nhập vào [Vercel Dashboard](https://vercel.com/dashboard)
- Chọn project của bạn
- Vào Settings → Environment Variables

### 2. Thêm các Environment Variables sau:

```
GEMINI_API_KEY_1=your_api_key_1
GEMINI_API_KEY_2=your_api_key_2
GEMINI_API_KEY_3=your_api_key_3
GEMINI_API_KEY_4=your_api_key_4
```

### 3. Cách thêm từng biến:
1. Click "Add New" hoặc "+"
2. **Name**: `GEMINI_API_KEY_1`
3. **Value**: Dán API key của bạn
4. **Environment**: Chọn cả 3 môi trường (Production, Preview, Development)
5. Click "Save"
6. Lặp lại cho `GEMINI_API_KEY_2`, `GEMINI_API_KEY_3`, `GEMINI_API_KEY_4`

## Deploy Steps

### Option 1: Deploy từ GitHub (Recommended)
1. Push code lên GitHub (đã làm)
2. Vào [Vercel Dashboard](https://vercel.com/new)
3. Click "Import Project"
4. Chọn repository: `CuongBC195/elearning`
5. Vercel sẽ tự động detect Next.js
6. **Quan trọng**: Thêm Environment Variables trước khi click "Deploy"
7. Click "Deploy"

### Option 2: Deploy bằng Vercel CLI
```bash
npm i -g vercel
vercel login
vercel
```

## Notes

- ✅ `.env.local` đã được ignore trong `.gitignore` (không push lên GitHub)
- ✅ Environment variables phải được set trong Vercel Dashboard
- ✅ Sau khi thêm environment variables, cần Redeploy để apply changes
- ✅ Free tier của Gemini API có 20 requests/ngày/key
- ✅ Với 4 keys, tổng cộng có thể có 80 requests/ngày

## Troubleshooting

### Nếu gặp lỗi "API keys not found":
- Kiểm tra lại tên environment variables (phải chính xác: `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, etc.)
- Đảm bảo đã chọn đúng Environment (Production/Preview/Development)
- Redeploy sau khi thêm environment variables

### Nếu gặp lỗi quota:
- Kiểm tra quota của từng API key trong [Google AI Studio](https://makersuite.google.com/app/apikey)
- Cân nhắc upgrade lên paid plan nếu cần nhiều requests hơn

