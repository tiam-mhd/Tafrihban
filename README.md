# تفریح‌بان

اپ فارسی‌محور برای پروندهٔ تجهیزات تفریحی، بازرسی، ایراد و تعمیرات. این نرم‌افزار گواهی ایمنی صادر نمی‌کند و وضعیت ثبت‌شده جای تصمیم متخصص بهره‌برداری را نمی‌گیرد.

## راه‌اندازی محلی

پیش‌نیازها: Node.js 20.9 یا بالاتر و PostgreSQL 15 یا بالاتر. نسخهٔ ۱۵ برای قیدهای `UNIQUE NULLS NOT DISTINCT` لازم است. بستهٔ scanner دوربین در این lockfile engine نسخهٔ ۲۴ Node را اعلام می‌کند؛ build سرور روی Node 22 انجام شده، اما برای بررسی مسیر دوربین Node 24 را به‌کار ببرید.

1. وابستگی‌های قفل‌شده را نصب کنید:

   ```powershell
   npm.cmd ci
   ```

2. `.env.example` را به `.env.local` کپی کنید و `DATABASE_URL`، سه secret مستقل، و نشانی `BETTER_AUTH_URL` را با مقادیر محلی و امن پر کنید. secretهای واقعی را commit نکنید. برای PostgreSQL یک پایگاه خالی بسازید.
3. schema را بسازید و مدیر کل پلتفرم را با مشخصات خود اپراتور ایجاد کنید:

   ```powershell
   npm.cmd run db:migrate
   npm.cmd run platform:bootstrap
   ```

   فرمان bootstrap فقط وقتی هر سه متغیر `SUPERADMIN_EMAIL`، `SUPERADMIN_NAME` و `SUPERADMIN_INITIAL_PASSWORD` تنظیم باشند اجرا می‌شود. رمز اولیه حداقل ۱۴ نویسه است. اجرای دوباره رمز موجود را عوض نمی‌کند و نقش‌های از قبل تخصیص‌یافته را downgrade نمی‌کند. مدیر تازه باید در اولین ورود رمز را عوض کند.

4. سرور توسعه را اجرا کنید:

   ```powershell
   npm.cmd run dev
   ```

   ورود پلتفرم در `/platform/login` است. از `/platform/organizations/new` سازمان، شعبه و مدیر عملیاتی نخست را بسازید. رمز موقت مدیر را بیرون از سامانه و از راه امن تحویل دهید. ورود عملیاتی از `/login` انجام می‌شود.

### دادهٔ آزمایشی توسعه

Seed فقط با `NODE_ENV=development` و `DEV_FIXTURE_PASSWORD` اپراتور اجرا می‌شود. این fixture ساختگی است و در production در دسترس نیست.

```powershell
$env:NODE_ENV = "development"
$env:DEV_FIXTURE_PASSWORD = "یک-رمز-محلی-تصادفی-۱۲-نویسه-یا-بیشتر"
npm.cmd run db:seed:dev
```

حساب آزمایشی `inspector@example.test` است. رمز را فقط برای محیط محلی نگه دارید.

## فرمان‌های کنترل کیفیت

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

آزمون مرز دیتابیس فقط وقتی `DATABASE_URL` باشد اجرا می‌شود. برای مسیر E2E کامل، migration را اجرا کنید، یک SUPERADMIN bootstrap و رمز آن را پس از ورود نخست تغییر دهید، سپس ایمیل/رمز فعلی آن را در `E2E_SUPERADMIN_EMAIL` و `E2E_SUPERADMIN_PASSWORD` قرار دهید. حساب آزمایش باید TOTP فعال نداشته باشد. Chromium را یک‌بار با `npm.cmd exec playwright install chromium` نصب کنید و سپس اجرا کنید:

```powershell
npm.cmd run e2e
```

آزمون سازمان موقت خود را پس از اجرا archive و حساب مدیر آن را suspend می‌کند. `E2E_BASE_URL` برای اجرای تست علیه سرور از قبل اجراشده اختیاری است.

`npm.cmd ci` در Node 22 با هشدار engine مربوط به ZXing و هشدار peer برخی افزونه‌های ESLint تمام می‌شود؛ lint و build در این نسخه اجرا شدند. Next 16.4+ از ESLint 10 پشتیبانی می‌کند، ولی dependencyهای افزونه‌ای اعلام peer را هنوز به‌روز نکرده‌اند.

## محدودهٔ پیاده‌سازی و شکاف‌های شناخته‌شده

- خروجی گزارش در MVP فایل CSV محدود و حسابرسی‌شده است؛ PDF ساخته نمی‌شود.
- پیاده‌سازی ذخیره‌سازی خصوصی فعلی برای میزبان واحد/محلی است. قرارداد provider جداست، اما object storage، اسکن بدافزار، retention policy و استقرار چندمیزبانه هنوز تنظیم نشده‌اند. در استقرار باید پوشهٔ خصوصی روی volume پایدار و خارج از web root باشد.
- همگام‌سازی آفلاین اکنون برای بازرسی، پاسخ‌ها و عکس‌هاست؛ صف هنگام foreground/retry اجرا می‌شود و پاسخ tenant وارد cache مشترک service worker نمی‌شود.
- تکمیل work order مدرک متنی الزامی دارد؛ پیوست عکس برای خود work order هنوز در دسترس نیست.
- بازیابی حساب توسط مدیر مجاز پلتفرم رمز موقت می‌سازد؛ تحویل امن خارج از سامانه بر عهدهٔ اپراتور است. SMTP، پیامک و پیوند خودکار بازیابی پیاده‌سازی نشده‌اند.
- TOTP برای مدیر پلتفرم پشتیبانی می‌شود؛ فعال‌سازی و الزام سازمانی آن باید در رویهٔ استقرار کنترل شود.
- UI فعلی فارسی و RTL است؛ locale و فیلد کاربر برای آمادگی انگلیسی وجود دارد، اما ترجمهٔ کامل انگلیسی آماده نیست.
- PostgreSQL RLS در این نسخه فعال نشده است؛ دفاع کنونی شامل scope سمت‌سرور، قیدهای مرکب و آزمون مرز tenant است. RLS و آزمون‌های بازیابی پشتیبان در hardening استقرار باقی‌اند.
- زمان‌های موعد با timezone شعبه در فرم تفسیر و به UTC ذخیره می‌شوند؛ بررسی بصری واقعی روی چند دستگاه/مرورگر باید پیش از عرضهٔ میدانی انجام شود.

## اسناد

- [`AGENTS.md`](AGENTS.md): قواعد پایدار مهندسی و امنیت.
- [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md): برنامه، فرض‌ها، تصمیم‌ها و محدودیت‌های این نسخه.
- [`Tafrihban_Technical_Engineering_Spec.md`](Tafrihban_Technical_Engineering_Spec.md): مشخصات فنی همگام‌شده با MVP.
- [`ADR-0001-modular-monolith.md`](ADR-0001-modular-monolith.md): تصمیم معماری و جداسازی هویت‌ها.
