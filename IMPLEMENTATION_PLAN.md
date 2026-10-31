# برنامه و فرض‌های پیاده‌سازی MVP

## برنامهٔ اجرا

1. حفظ مخزن مستندسازی‌شده و افزودن Next.js modular monolith، PostgreSQL و migration پایه.
2. ساخت مدل جهانی کاربران عملیاتی، membership و نقش‌های scoped، و هویت/session/role/audit مستقل پلتفرم.
3. تکمیل bootstrap مدیر کل و مسیر ساخت سازمان، شعبه و مدیر مشتری.
4. پیاده‌سازی پروندهٔ تجهیز، checklistهای نسخه‌دار، زمان‌بندی و ثبت بازرسی.
5. افزودن defect، corrective action، work order و audit trail.
6. افزودن گزارش CSV محدود، فایل خصوصی، صف IndexedDB، PWA shell و QR/manual lookup.
7. اجرای آزمون مرز دسترسی، تست‌های نرم‌افزاری و build؛ ثبت محدودیت هر ابزار محیطی.

## فرض‌ها و تصمیم‌ها

- PostgreSQL 15+ برای قیدهای مرکب و `UNIQUE NULLS NOT DISTINCT` در migration پایه در دسترس است.
- timezone مجموعه و شعبه به‌عنوان شناسهٔ IANA می‌آید؛ timestamp ذخیره‌شده در دیتابیس UTC است.
- یک میزبان برنامه و ذخیره‌ساز فایل خصوصی محلی برای توسعه کافی است؛ در چندمیزبانه باید provider object storage پیاده شود.
- ایمیل/پیامک خروجی در محیط حاضر فراهم نیست؛ provisioning و بازیابی رمز به رمز اولیهٔ اپراتور و تحویل خارج از سامانه متکی است.
- SUPERADMIN با اجرای صریح bootstrap و secretهای اپراتور ساخته می‌شود؛ هیچ هویت واقعی یا رمز پیش‌فرضی در مخزن وجود ندارد.
- هر ثبت آفلاین فقط پس از تأیید سرور synced است؛ صف فعلی به بازرسی محدود است و بارگذاری عکس تا همگام‌سازی عقب می‌افتد.

## خطرها و کنترل‌ها

| مورد | کنترل فعلی | کار باقیمانده |
|---|---|---|
| نشت بین tenantها | scope از session و membership، قیدهای مرکب، آزمون SQL مرز دسترسی | اجرای آزمون integration روی PostgreSQL واقعی و ارزیابی RLS |
| رمز موقت و بازیابی | جداکردن sessionها، تغییر اجباری رمز، ابطال session و audit | ارائهٔ ایمیل بازیابی فقط پس از پیکربندی provider و بررسی عملیاتی |
| فایل خصوصی | کنترل MIME/حجم، نام تصادفی، access token کوتاه‌عمر، پوشه خارج از public | object storage، اسکن و retention برای استقرار چندمیزبانه |
| آفلاین | شناسهٔ event یکتا، schema version، زمان محلی و server receipt، تعارض مشخص | آزمون واقعی قطع/وصل روی مرورگر میدانی و همگام‌سازی پس‌زمینه |
| نقش و wildcard | تخصیص scoped و `grants_all_permissions` برای SUPERADMIN | bootstrap idempotency نیازمند اجرای DB زنده است |

## وضعیت راستی‌آزمایی این اجرا

- `npm.cmd ci --no-audit` موفق شد و ۴۰۹ بسته را از lockfile نصب کرد.
- `npm.cmd run typecheck`، `npm.cmd run lint`، `npm.cmd test` و `npm.cmd run build` موفق شدند؛ test: پنج مورد موفق و یک آزمون DB به‌دلیل نبود `DATABASE_URL` skip شد.
- `npm.cmd audit --audit-level=moderate` صفر آسیب‌پذیری گزارش کرد. برای این کار `minimatch` به نسخهٔ اصلاح‌شدهٔ advisory pin شد.
- `npm.cmd run e2e` یک مسیر مرورگری را به‌دلیل نبود envهای E2E و DB skip کرد؛ مرورگر Chromium هم در محیط نصب نبود.
- shim محدود `scripts/tsx-os-shim.cjs` خطای `uv_os_get_passwd returned ENOMEM` در Windows managed runner را فقط برای launcher ابزارهای TypeScript دور می‌زند. پس از آن، `npm.cmd run db:migrate` به guard رسید و به‌درستی به‌دلیل نبود `DATABASE_URL` متوقف شد؛ `npm.cmd run platform:bootstrap` هم به‌دلیل نبود secretهای اپراتور متوقف شد. اتصال مستقیم به PostgreSQL محلی نیز با `fe_sendauth: no password supplied` رد شد؛ migration تازه، bootstrap واقعی و آزمون idempotency DB اجرا نشده‌اند.
- نسخهٔ Node این اجرا 22.15 بود؛ `@zxing/library@0.23.0` engine نسخهٔ 24+ اعلام می‌کند. کامپایل/build موفق شد، اما اجرای واقعی scanner روی محیط سازگار هنوز انجام نشده است.
- بازبینی بصری روی دستگاه و مرورگر واقعی انجام نشده است.
