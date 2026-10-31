# ADR-0001: modular monolith و جداسازی دو هویت

- وضعیت: پذیرفته‌شده برای MVP
- تاریخ: 2026-10-31

## زمینه

گردش‌کار بازرسی، عیب و تعمیرات به یک چرخهٔ تراکنشی و audit مشترک نیاز دارد. در عین حال، کاربران عملیاتی tenantها و مدیر پلتفرم session، role و مرز دسترسی متفاوت دارند.

## تصمیم

- برنامه در Next.js modular monolith باقی می‌ماند؛ domain/serviceها بر اساس هویت، سازمان، تجهیزات، بازرسی و مدارک جدا هستند.
- PostgreSQL منبع حقیقت است. درخواست‌های صفحه و Server Action تنها با session معتبر و scope حل‌شده از membership query می‌زنند.
- Better Auth با دو پیکربندی، دو namespace جدول، دو base path و دو cookie prefix جدا برای ورود عملیاتی و پلتفرم به کار می‌رود.
- قیدهای مرکب organization/branch، مرز رابطه‌ها را در دیتابیس هم اعمال می‌کنند. RLS در MVP فعال نیست.
- صف آفلاین inspection در IndexedDB نگهداری می‌شود؛ service worker فقط shell ایستا را cache می‌کند.
- provider فایل خصوصی در MVP روی فایل‌سیستم میزبان است و با interface قابل‌تعویض جدا شده است.

## پیامدها

- راه‌اندازی یک برنامه و یک PostgreSQL ساده می‌ماند و تراکنش‌های گردش‌کار محلی‌اند.
- نسخهٔ production چندمیزبانه به object storage، RLS دفاعی، ارسال پیام بازیابی، پشتیبان/بازیابی آزمایش‌شده و سیاست MFA نیاز دارد.
- هر endpoint یا Server Action جدید باید guard، scope، schema و audit مربوط به عملیات را صریح پیاده کند.
