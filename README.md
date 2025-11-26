# Frontend Setup & Deployment Guide

این پوشه یک وب‌سایت استاتیک (HTML/CSS/JS) است و به بیلد نیاز ندارد. می‌توانید آن را روی GitHub Pages، Render Static Site یا هر هاست استاتیک دیگری منتشر کنید.

## 1) ساخت ریپوی جدا برای فرانت‌اند
- یک ریپوی جدید در GitHub بسازید (مثلاً `ecotwin-frontend`).
- تمام محتوای پوشه `frontend/` را در ریشه همان ریپو قرار دهید و Push کنید.
  - فایل‌های مهم: `index.html`, `style.css`, `modules/*`, `config.js`, `.nojekyll`, `README.md`, و در صورت داشتن دامنه سفارشی: `CNAME`.

## 2) استقرار روی GitHub Pages (بدون نیاز به سرور)
1. ریپو → Settings → Pages
2. Source: `main` و Folder: `/ (root)` را انتخاب و Save کنید.
3. پس از چند دقیقه، سایت در آدرس `https://<username>.github.io/<repo>` در دسترس است.
4. دامنه سفارشی (اختیاری):
   - فایل `CNAME` در ریشه ریپو باید حاوی دامنه باشد (مثلاً `ecotwinai.com`).
   - در DNS یک رکورد CNAME بسازید به `<username>.github.io` و در Pages، Custom domain را تنظیم کنید و HTTPS را فعال کنید.

### اتصال به بک‌اند
- فایل `config.js` به‌صورت پیش‌فرض به `https://ecotwin-energyvis-api.onrender.com` وصل است.
- برای تست یا تغییر موقت API بدون تغییر کد:
  - انتهای URL سایت بنویسید: `?api=<FULL_API_BASE_URL>`
  - مثال: `?api=https://ecotwin-energyvis-api.onrender.com`
- برای اتصال دائمی در مرورگر: در کنسول بنویسید `localStorage.setItem('API_BASE_URL','https://...')` و صفحه را رفرش کنید.

### تنظیم CORS در بک‌اند
- در سرویس بک‌اند (Render) متغیر محیطی `FRONTEND_URLS` باید Origin فرانت‌اند را شامل شود:
  - GitHub Pages عادی: `https://<username>.github.io`
  - اگر زیرپوشه دارد: `https://<username>.github.io/<repo>`
  - دامنه سفارشی: `https://ecotwinai.com`
- پس از تغییر، Redeploy کنید.

## 3) استقرار روی Render Static Site (اختیاری)
- اگر از Blueprint استفاده می‌کنید، فایل `render.yaml` شامل سرویس Static با `publishPath: frontend` است.
- یا دستی بسازید: New → Static Site → ریپو را انتخاب کنید:
  - Build Command: خالی
  - Publish Directory: `frontend`
- Auto-Deploy را به دلخواه فعال کنید.

## 4) اجرای لوکال
```bash
cd frontend
npx serve -l 8080
# سپس http://localhost:8080 را باز کنید
```
- اتصال به بک‌اند آنلاین در لوکال: آدرس را با `?api=https://ecotwin-energyvis-api.onrender.com` باز کنید.

## 5) نکات فنی
- Mapbox از CDN بارگذاری می‌شود؛ فقط باید توکن بک‌اند معتبر باشد.
- `config.js` ترتیب تشخیص API:
  1) `window.API_BASE_URL` اگر قبل از لود تنظیم شود
  2) پارامتر URL `?api=`
  3) `localStorage.API_BASE_URL`
  4) پیش‌فرض: `https://ecotwin-energyvis-api.onrender.com`
