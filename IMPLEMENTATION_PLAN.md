# برنامه و فرض‌های پیاده‌سازی MVP

## برنامهٔ اجرا

1. حفظ مخزن مستندسازی‌شده و افزودن Next.js modular monolith، PostgreSQL و migration پایه.
2. ساخت مدل جهانی کاربران عملیاتی، membership و نقش‌های scoped، و هویت/session/role/audit مستقل پلتفرم.
3. تکمیل bootstrap مدیر کل و مسیر ساخت سازمان، شعبه و مدیر مشتری.
4. پیاده‌سازی پروندهٔ تجهیز، checklistهای نسخه‌دار، زمان‌بندی و ثبت بازرسی.
5. افزودن defect، corrective action، work order و audit trail.
6. افزودن گزارش CSV محدود، فایل خصوصی، صف IndexedDB، PWA shell و QR/manual lookup.
7. اجرای آزمون مرز دسترسی، تست‌های نرم‌افزاری و build؛ ثبت محدودیت هر ابزار محیطی.
8. تکمیل درخواست تغییر محصول: استفادهٔ سراسری از لوگوهای مالک محصول و Vazirmatn Variable محلی؛ ورود OTP عملیاتی ParsGreen؛ provisioning سلسله‌مراتبی مدیر مجموعه/مدیر شعبه/اعضای عادی و regression coverage.

## فرض‌ها و تصمیم‌ها

- PostgreSQL 15+ برای قیدهای مرکب و `UNIQUE NULLS NOT DISTINCT` در migration پایه در دسترس است.
- timezone مجموعه و شعبه به‌عنوان شناسهٔ IANA می‌آید؛ timestamp ذخیره‌شده در دیتابیس UTC است.
- یک میزبان برنامه و ذخیره‌ساز فایل خصوصی محلی برای توسعه کافی است؛ در چندمیزبانه باید provider object storage پیاده شود.
- کاربران عملیاتی با شمارهٔ همراه ایران به‌شکل E.164 و OTP پیامکی ParsGreen وارد می‌شوند؛ توکن فقط در runtime سرور با `PARSGREEN_API_TOKEN` قرار می‌گیرد. مدیران پلتفرم احراز هویت مجزای ایمیل/رمز و TOTP اختیاری خود را حفظ می‌کنند.
- حساب عملیاتی فقط توسط مدیر محدوده ساخته/متصل می‌شود: platform admin مدیر مجموعه را تعریف می‌کند، مدیر مجموعه مدیر شعبه را در شعبهٔ مشخص می‌سازد و مدیر شعبه اعضای عادی همان شعبه را مدیریت می‌کند.
- `TAFRIHBAN_TEST_OTP_SINK=1` فقط برای مرورگر E2E محلی مجاز است؛ این sink هیچ پیامکی نمی‌فرستد و در production غیرفعال است.
- SUPERADMIN با اجرای صریح bootstrap و secretهای اپراتور ساخته می‌شود؛ هیچ هویت واقعی یا رمز پیش‌فرضی در مخزن وجود ندارد.
- هر ثبت آفلاین فقط پس از تأیید سرور synced است؛ صف فعلی به بازرسی محدود است و بارگذاری عکس تا همگام‌سازی عقب می‌افتد.

## خطرها و کنترل‌ها

| مورد | کنترل فعلی | کار باقیمانده |
|---|---|---|
| نشت بین tenantها | scope از session و membership، قیدهای مرکب، آزمون SQL مرز دسترسی | اجرای آزمون integration روی PostgreSQL واقعی و ارزیابی RLS |
| ارسال OTP | توکن در سمت سرور، callback با HTTPS، خطای عمومی، محدودیت Better Auth و fake-fetch regression test | اعتبارسنجی عملیاتی با توکن و شمارهٔ تحت کنترل اپراتور |
| بازیابی پلتفرم | مسیر مدیر پلتفرم جدا با ایمیل/رمز و TOTP اختیاری | recovery خودکار همچنان به provider/policy مستقل نیاز دارد؛ رویه فعلاً operator-mediated است |
| فایل خصوصی | کنترل MIME/حجم، نام تصادفی، access token کوتاه‌عمر، پوشه خارج از public | object storage، اسکن و retention برای استقرار چندمیزبانه |
| آفلاین | شناسهٔ event یکتا، schema version، زمان محلی و server receipt، تعارض مشخص | آزمون واقعی قطع/وصل روی مرورگر میدانی و همگام‌سازی پس‌زمینه |
| نقش و wildcard | تخصیص scoped و `grants_all_permissions` برای SUPERADMIN | bootstrap idempotency نیازمند اجرای DB زنده است |

## وضعیت راستی‌آزمایی این اجرا

- کد ورود عملیاتی به Better Auth Phone Number و provider رسمی ParsGreen منتقل شده؛ `PARSGREEN_API_TOKEN` تنها env لازم برای ارسال provider است. هیچ token یا شمارهٔ واقعی در مخزن/fixture قرار نگرفته است.
- فونت Vazirmatn Variable با نسخهٔ دقیق `5.3.0` به lockfile افزوده شده و درخواست runtime به CDN ندارد. لوگوهای Light/Dark کاربر در تمام shellهای پروژه و metadata/manifest استفاده شده‌اند.

- `npm.cmd run lint`، `npm.cmd run typecheck` و `npm.cmd test` موفق شدند. از ۱۳ تست، ۱۲ مورد پاس شدند و آزمون مرز DB به‌علت نبود `DATABASE_URL` skip شد.
- `npm.cmd run build` با متغیرهای موقت `BETTER_AUTH_SECRET`، `PLATFORM_AUTH_SECRET`، `FILE_URL_SECRET` و یک URL ساختگی محلی موفق شد؛ build به PostgreSQL اتصال نمی‌گیرد. اجرای بدون این متغیرهای الزامی طبق انتظار fail-closed است.
- `npm.cmd run e2e` یک مسیر مرورگری را به‌دلیل نبود DB، مدیر E2E و OTP sink محلی skip کرد؛ هیچ SMS واقعی ارسال نشده است.
- `npm.cmd run db:migrate` به‌دلیل نبود `DATABASE_URL` و `npm.cmd run platform:bootstrap` به‌دلیل نبود secretهای SUPERADMIN در guard متوقف شدند. migration تازه، bootstrap واقعی و آزمون idempotency DB اجرا نشده‌اند. `.env.local` در این محیط وجود ندارد.
- `server-only` به dependency مستقیم runtime اضافه شد؛ تست launcher نشان داد فرمان bootstrap اکنون به guard تنظیمات می‌رسد و خطای `Cannot find module 'server-only'` تکرار نمی‌شود.
- ارسال واقعی ParsGreen با توکن اپراتور انجام نشد. قرارداد HTTPS، header و body در fake-fetch test بررسی شد؛ برای runtime فقط `PARSGREEN_API_TOKEN` باید از secret store تنظیم شود.
- Vazirmatn Variable با نسخهٔ دقیق `5.3.0` از package محلی bundle می‌شود؛ لوگوهای Light/Dark در نقاط برند، metadata و manifest استفاده شده‌اند. بازبینی بصری روی دستگاه/مرورگر واقعی هنوز انجام نشده است.
- نسخهٔ Node این اجرا 22.15 بود؛ `@zxing/library@0.23.0` engine نسخهٔ 24+ اعلام می‌کند. کامپایل/build موفق شد، اما اجرای واقعی scanner روی محیط سازگار هنوز انجام نشده است.
