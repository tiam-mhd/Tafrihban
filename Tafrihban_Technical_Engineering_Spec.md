# تفریح‌بان | مشخصات فنی، مهندسی و UI/UX

**نسخه:** 1.0  
**تاریخ:** ۳۱ اکتبر ۲۰۲۶  
**وضعیت:** مرجع طراحی نسخهٔ اولیه و تصمیم‌های پایه

## ۱. قواعد تصمیم‌گیری فنی

1. محصول ابتدا به‌صورت modular monolith ساخته شود؛ سرویس‌های جدا فقط وقتی نیاز عملیاتی و مقیاس آن را ثابت کرد.
2. هر قابلیت تازه باید از ماژول دامنه، مجوز، محدودهٔ tenant، لاگ، تست و migration لازم عبور کند.
3. نسخه‌های کتابخانه‌ها و سازگاری‌شان با پشتهٔ انتخابی در روز پیاده‌سازی از مستندات رسمی بررسی شوند؛ نسخهٔ ثابت یا قدیمی را کورکورانه کپی نکن.
4. قبل از کدنویسی مخزن را بررسی کن و فناوری موجود را بی‌دلیل عوض نکن. اگر پروژه خالی است، پشتهٔ پیشنهادی زیر مبناست.
5. ماژول‌های آینده فقط extension point و طراحی دادهٔ لازم می‌گیرند؛ تمام roadmap در MVP پیاده‌سازی نشود.
6. تصمیم‌های پراثر در ADR کوتاه در مخزن ثبت شوند.

## ۲. پشتهٔ پیشنهادی

| بخش | فناوری پیشنهادی | الزام |
|---|---|---|
| وب و سرور | Next.js App Router، React، TypeScript با strict mode | نسخهٔ پایدار سازگار در زمان اجرا؛ رندر سروری برای صفحات مجاز، منطق امنیتی فقط سرور |
| پایگاه داده | PostgreSQL | constraint و migration واقعی؛ نوع زمان UTC؛ دادهٔ tenant با organization_id و در محل نیاز branch_id |
| ORM/مهاجرت | Drizzle ORM یا ابزار رسمی/فعال مشابه | query پارامتری، schema خوانا، migration کنترل‌شده؛ انتخاب نهایی در ADR |
| اعتبارسنجی | Zod یا ابزار schema فعال مشابه | اعتبارسنجی ورودی سمت سرور؛ اعتبارسنجی کلاینت فقط برای UX کافی نیست |
| فرم | React Hook Form همراه schema | خطای فیلد روشن و دسترس‌پذیر؛ الگوی مناسب RTL |
| ظاهر | Tailwind CSS و shadcn/ui یا اجزای هم‌سطح | design tokens، اجزای مشترک، قابلیت RTL واقعی |
| آیکون | Lucide یا مجموعهٔ کوچک دارای مجوز مناسب | آیکون با متن یا label دسترس‌پذیر |
| PWA | Service Worker؛ Serwist فقط پس از تأیید سازگاری فعلی با Next.js | cache نسخه‌دار، به‌روزرسانی کنترل‌شده، بدون کش کردن پاسخ حساس به‌شکل مشترک |
| ذخیرهٔ آفلاین | IndexedDB با Dexie یا wrapper فعال هم‌سطح | صف عملیات با شناسهٔ یکتا، نسخه، وضعیت sync و مدیریت خطا |
| دسترسی دادهٔ کلاینت | TanStack Query در صورت نیاز به کش/همگام‌سازی سمت کلاینت | صرفاً پس از تعریف مرز؛ منبع مجوز همیشه سمت سرور |
| تاریخ | ذخیرهٔ timestamp استاندارد در UTC؛ نمایش محلی ایران و شمسی با کتابخانهٔ بررسی‌شده | تاریخ شمسی برای UI، نه قالب ذخیره‌سازی یا کلید مرتب‌سازی |
| فایل | ذخیره‌ساز object storage از طریق adapter | فایل خصوصی، URL امضاشدهٔ زمان‌دار، محدودیت حجم/نوع و پاک‌سازی |
| تست | Vitest یا Jest فعال، Playwright برای مسیرهای مرورگر | تست دسترسی بین tenant، مسیرهای حیاتی، آفلاین و bootstrap |
| پایش | لاگ ساخت‌یافته و ارائه‌دهندهٔ قابل‌تعویض | دادهٔ شخصی/رمز/توکن در لاگ ممنوع |
| احراز هویت | کتابخانهٔ امن و نگهداری‌شده با adapter داخلی | رمزنگاری و session از صفر نوشته نشود؛ حساب پلتفرم و عملیاتی گارد و session جدا داشته باشند |

انتخاب نام کتابخانه، نسخه و API نهایی باید بر پایهٔ مستندات رسمی همان نسخه و سازگاری واقعی باشد. اگر پشتهٔ موجود با پیشنهادی متفاوت است، دلیل، هزینه و پیامد آن در ADR ثبت شود.

## ۳. معماری نرم‌افزار

### لایه‌ها

1. **UI:** صفحات، اجزا، فرم و حالت‌های loading/empty/error/offline.
2. **Application services:** موردهای کاربردی مثل CompleteInspection و AssignWorkOrder؛ ورودی را اعتبارسنجی و مجوز را اعمال می‌کنند.
3. **Domain:** قواعد بازرسی، وضعیت عیب، زمان‌بندی و انتقال وضعیت.
4. **Infrastructure:** Postgres/ORM، object storage، ایمیل/SMS/push و اتصالات بیرونی.
5. **Identity and authorization:** حل نشست و هویت، کنترل tenant/branch، نقش و مجوز.

کامپوننت UI نباید مستقیماً جدول پایگاه داده را دستکاری کند. Server Action یا Route Handler فقط در صورت عبور از schema validation، احراز هویت، authorization و فراخوانی service مجاز است. Serviceهای سرور باید محدودهٔ فعال را از هویت معتبر به‌دست آورند، نه از organization_id یا branch_id قابل دستکاری مرورگر.

### ماژول‌های دامنه

- platform-admin
- identity-and-membership
- organization-and-branch
- authorization
- equipment
- checklist-and-template
- inspection
- defect-and-corrective-action
- maintenance-and-work-order
- documents-and-certificates
- notifications
- reports
- billing (غیرفعال در نسخهٔ اول مگر تصمیم جداگانه)
- audit
- offline-sync

### چیدمان راهنمای پروژه

ساختار زیر یک راهنمای شروع است؛ با ساختار موجود هماهنگ شود و بی‌جهت پیچیده نشود.

    src/
      app/
        (public)/
        (operational)/
        admin/
        api/
      modules/
        organizations/
        branches/
        identity/
        authorization/
        equipment/
        checklists/
        inspections/
        defects/
        work-orders/
        documents/
        reports/
        notifications/
        audit/
        offline-sync/
      components/
        ui/
        layout/
      server/
        auth/
        database/
        storage/
        security/
      lib/
        validation/
        dates/
        i18n/
        errors/
      styles/
    db/
      schema/
      migrations/
      seeds/
    tests/
      unit/
      integration/
      e2e/
    public/
      manifest.webmanifest
      icons/

ماژول‌ها باید مرز import روشن داشته باشند. Shared helper فقط برای منطق مشترک استفاده شود؛ منطق دامنه در پوشهٔ generic utils پنهان نشود.

## ۴. مدل داده و جداول اجباری

نام‌ها نمونهٔ فنی‌اند؛ migration باید روابط، کلیدهای خارجی، unique constraint، index، حذف منطقی/آرشیو و audit لازم را پیاده کند.

### ۴.۱ هویت عملیاتی و چندمجموعه‌ای

| جدول | حداقل فیلد/قید مهم |
|---|---|
| organizations | id، name، slug، status، timezone، created_at، archived_at |
| branches | id، organization_id، name، code، address، timezone اختیاری، status؛ unique روی organization_id + code |
| users | id، نام نمایشی، email داخلی یکتا، شمارهٔ همراه ایران در E.164 با unique index، phone_number_verified، وضعیت، locale، created_at؛ هویت عملیاتی یکتا در کل سامانه |
| organization_memberships | id، user_id، organization_id، status، invited_at، joined_at؛ unique user_id + organization_id |
| branch_memberships | membership_id، branch_id، status؛ کنترل شود که branch متعلق به همان organization عضویت است |
| operational_roles | id، organization_id، name، description، is_system_role؛ نقش پایهٔ پلتفرم فقط اگر نیاز دامنه دارد |
| permissions | id، key یکتا، description، module، status |
| operational_role_permissions | role_id، permission_id |
| membership_role_assignments | membership_id، role_id، scope_type، organization_id، branch_id nullable، assigned_by، created_at |
| user_sessions یا جدول adapter احراز هویت | نشست کاربر عملیاتی؛ نباید با نشست مدیر پلتفرم مشترک شود |

پیشنهاد محدودهٔ مجوز: organization-wide وقتی branch_id تهی است؛ branch-scoped وقتی branch_id دارد. شکل دقیق باید constraint داشته باشد تا branch از organization دیگری به عضویت/نقش متصل نشود. یک حساب می‌تواند عضویت‌های مستقل داشته باشد و نقش یک شعبه را به شعبهٔ دیگر تعمیم ندهد.

### ۴.۲ مدیران پلتفرم و دسترسی‌های مستقل

| جدول | حداقل فیلد/قید مهم |
|---|---|
| platform_admins | id، email یکتا، name، credential/auth reference، status، created_at، last_login_at |
| platform_admin_roles | id، key یکتا، name، description، grants_all_permissions boolean |
| platform_permissions | id، key یکتا، description، module، status |
| platform_role_permissions | role_id، permission_id |
| platform_admin_role_assignments | platform_admin_id، role_id، assigned_by، created_at |
| platform_admin_sessions | نشست مستقل مدیر پلتفرم، revoke_at، metadata ایمن |
| platform_admin_audit_events | actor، action، entity، entity_id، reason، timestamp، request_id، context امن |

مسیر UI، guard، session cookie، permission resolver و audit مدیر پلتفرم مستقل باشد. مدیر سامانه نباید صرفاً کاربر عملیاتی با یک role ویژه باشد. برای SUPERADMIN، نقش پلتفرمی با grants_all_permissions=true تعریف شود. موتور مجوز این حالت را برای همهٔ permissionهای فعال، از جمله مجوزهایی که بعداً به جدول افزوده می‌شوند، به‌عنوان wildcard معتبر بررسی کند. به درج دستی تک‌تک مجوزها در role_permissions اتکا نکن.

### ۴.۳ مدل SUPERADMIN

- حساب با seed/CLI امن و idempotent ساخته شود؛ تنها وقتی متغیرهای محیطی لازم فراهم‌اند.
- متغیرهای نمونه در فایل env راهنما: SUPERADMIN_EMAIL، SUPERADMIN_NAME، SUPERADMIN_INITIAL_PASSWORD. مقدار واقعی، پیش‌فرض عمومی یا secret در Git قرار نگیرد.
- اگر حساب موجود است، اجرای دوبارهٔ seed آن را reset یا downgrade نکند.
- رمز اولیه پس از ورود مجبور به تغییر باشد؛ سیاست MFA برای مدیر پلتفرم از ابتدا قابل پیکربندی باشد.
- حساب Superadmin دسترسی سراسری به ایجاد/ویرایش سازمان و شعبه، تنظیمات اولیه، حساب‌های مدیر مشتری و نقش‌های پلتفرم دارد.
- همهٔ اقدامات فراسازمانی ثبت شوند؛ عملیات پرخطر درخواست reason/تأیید دوباره بگیرد.
- هنگام ایجاد مجوز جدید، wildcard دسترسی را خودبه‌خود پوشش دهد؛ هیچ کد یا migration دستی برای افزودن مجوز به Superadmin لازم نباشد.
- ابزار recovery مستند و محدود باشد؛ ایجاد مدیر دوم فقط توسط Superadmin یا راه بازیابی کنترل‌شده انجام شود.

### ۴.۴ جداول هستهٔ محصول

| حوزه | جداول پیشنهادی |
|---|---|
| تجهیزات | equipment, equipment_categories, equipment_identifiers, equipment_status_events |
| فرم | checklist_templates, checklist_template_versions, checklist_sections, checklist_questions, checklist_options |
| برنامه | inspection_schedules, schedule_assignments |
| اجرا | inspections, inspection_answers, inspection_attachments, offline_sync_events |
| ایراد | defects, corrective_actions |
| تعمیر | work_orders, work_order_events, work_order_attachments, maintenance_plans |
| مدارک | documents, document_versions, certificates |
| فایل | file_objects با metadata؛ محتوای فایل فقط در object storage خصوصی |
| اعلان | notification_preferences, notifications, delivery_attempts |
| حسابرسی | audit_events برای عملیات دامنه؛ append-only تا حد معماری و کنترل دسترسی |
| قابلیت | feature_flags با scope روشن، نه شرط‌های پراکنده در UI |

هر ردیف متعلق به مشتری باید organization_id داشته باشد. دادهٔ شعبه‌ای branch_id هم داشته باشد. روابط باید constraint یا validation تراکنشی داشته باشند تا asset، branch، checklist، inspection و work order میان دو سازمان به هم متصل نشوند.

### ۴.۵ کلید، حذف و تاریخچه

- ID عمومی تصادفی/غیرقابل حدس به‌تنهایی مجوز دسترسی نیست.
- حذف تجهیز و کاربر به‌طور پیش‌فرض archive/deactivate است؛ تاریخچهٔ بازرسی پاک نمی‌شود.
- انتقال وضعیت‌های حساس به‌صورت event یا ثبت تاریخچه نگه داشته شود.
- زمان وقوع سمت کاربر و زمان دریافت سمت سرور جدا ذخیره شود؛ زمان کلاینت قابل اعتماد قطعی نیست.
- money در کوچک‌ترین واحد پولی مورد توافق به‌صورت integer ذخیره شود؛ نمایش تومان/ریال از تنظیمات باشد.
- timestamp به UTC ذخیره و در UI با منطقهٔ زمانی شعبه نمایش داده شود.

## ۵. تفکیک سازمانی و امنیت دسترسی

### الزام مجوزدهی

- **Deny by default:** هر عملیات بدون مجوز صریح رد شود.
- مجوز در application service سمت سرور کنترل شود؛ مخفی‌کردن دکمهٔ UI کنترل امنیت نیست.
- actor، membership فعال، سازمان، شعبه، نقش و permission با اطلاعات معتبر session تعیین شوند.
- هر query یا mutation دارای organization scope باشد؛ branch scope نیز بر اساس مجوز مؤثر اعمال شود.
- client هیچ‌گاه مرجع اعتماد برای role، user_id، tenant_id، permission یا وضعیت Superadmin نیست.
- ورودی organization_id/branch_id از URL یا form فقط درخواست محدوده است؛ سرور تعلق و مجوز آن را resolve می‌کند.
- برای query حساس، راهنمای RLS در PostgreSQL به‌عنوان لایهٔ دفاعی اضافه شود؛ RLS جایگزین مجوز application نیست و باید اتصال/transaction context درست و تست‌شده داشته باشد.
- بررسی شناسهٔ تصادفی و عدم افشای وجود رکوردهای tenant دیگر در خطاها.

### امنیت پایه

- HTTPS برای محیط تولید و قابلیت‌های Service Worker/دوربین.
- Cookie نشست HttpOnly، Secure و SameSite؛ حفاظت CSRF برای mutationهای cookie-based.
- رمز فقط با الگوریتم password hashing استاندارد و کتابخانهٔ نگهداری‌شده؛ رمزنگاری سفارشی ممنوع.
- محدودسازی نرخ و کنترل تلاش ورود، بازیابی امن، revoke نشست و انقضای نشست.
- CSP، encoding خروجی، validation ورودی، query پارامتری و جلوگیری از XSS/SQL injection.
- MFA و احراز هویت قوی برای مدیر پلتفرم؛ عدم استفاده از ایمیل/OTP تنها برای عملیات فوق‌حساس.
- secret فقط در secret manager یا env امن deployment؛ هیچ‌گاه در commit، log یا bundle مرورگر.
- فایل: private bucket، allowlist MIME، بررسی signature، محدودیت حجم، نام تصادفی، اسکن malware جایی که در دسترس است و URL امضاشدهٔ کوتاه‌عمر.
- log شامل رمز، OTP، token، تصویر یا اطلاعات حساس فرم نباشد.
- سرپرست پشتیبانی از tenantها فقط با مجوز، reason و audit دسترسی بگیرد.
- ارائهٔ سیاست پشتیبان‌گیری، retention، export و حذف دادهٔ مشتری.

## ۶. PWA، آفلاین و قابلیت‌های دستگاه

### اسکن QR و دوربین

- فقط هنگام انتخاب کاربر درخواست مجوز دوربین شود و علت استفاده مشخص باشد.
- اسکن دوربین در HTTPS انجام شود؛ اگر مجوز، دستگاه یا مرورگر در دسترس نیست، جست‌وجوی دستی با شناسه و ورودی دوربین دستگاه جایگزین باشد.
- اگر QR شناسهٔ داخلی دارد، endpoint پس از احراز هویت و مجوز، داده را برگرداند؛ QR حامل token دسترسی دائمی نباشد.
- خروجی هر QR باید قابل تعویض/ابطال باشد.

### همگام‌سازی آفلاین

- فقط دادهٔ ضروری شعبه/کارهای تخصیص‌یافته در دستگاه cache شود؛ cache حاوی دادهٔ سازمانی بین حساب‌ها مشترک نباشد.
- صف هر عملیات شامل client_event_id یا UUID یکتا، actor، زمان محلی، schema version، payload، status و تعداد retry باشد.
- سرور هر submission را idempotent پردازش کند تا retry رکورد تکراری نسازد.
- پاسخ sync شامل نتیجهٔ هر آیتم و خطای قابل فهم باشد؛ شکست یک آیتم کل صف را نابود نکند.
- عکس به صف بارگذاری مستقل با checksum و retry محدود وصل شود.
- data sync pending، failed، conflict و synced در UI متمایز باشد.
- عملیات حساس یا دارای تعارض داده تا تأیید سمت سرور، «نهایی» نمایش داده نشود.
- خروج از حساب یا لغو عضویت، اطلاعات محلی آن حساب را پاک/غیرفعال کند؛ زمان نگهداری محلی حداقلی باشد.
- سیاست cache نسخه‌دار و پاک‌سازی cache قدیمی تعریف شود؛ پاسخ‌های شخصی API در cache عمومی service worker قرار نگیرند.

### Push و SMS

- Push وب وابسته به پشتیبانی مرورگر، HTTPS، Service Worker و اجازهٔ کاربر است؛ گزینهٔ خاموش‌کردن و اعلان درون‌برنامه‌ای وجود داشته باشد.
- ارسال SMS با provider سمت سرور و adapter انجام شود؛ مرورگر قرار نیست بی‌صدا SMS بفرستد. بازکردن sms: فقط fallback برای composer بومی است، نه ارسال خودکار.
- email/SMS/push در صف delivery با idempotency، retry و گزارش خطا اداره شود.

در تصمیم MVP این سند، ورود کاربران عملیاتی با Better Auth Phone Number OTP و ParsGreen انجام می‌شود. `PARSGREEN_API_TOKEN` فقط سمت سرور است؛ کد OTP را Better Auth می‌سازد و provider فقط شماره و کد را می‌فرستد. ثبت‌نام عمومی خاموش است و provisioning عضویت را مدیر محدوده انجام می‌دهد. مدیر پلتفرم همچنان از احراز هویت جداگانهٔ ایمیل/رمز و TOTP اختیاری استفاده می‌کند.

## ۷. UI/UX و طراحی تجربه

### اصول تجربه

- فارسی و RTL از ابتدا، نه وصلهٔ بعدی. تمام فاصله‌گذاری، جدول، آیکون جهت‌دار، breadcrumb و فرم با RTL بررسی شود.
- Vazirmatn Variable از بستهٔ local و lockfileدار بارگذاری شود؛ فونت runtime به CDN وابسته نباشد و fallbackهای سیستم برای پوشش خطای بارگذاری باقی بمانند.
- از `public/Light-Logo.png` روی سطح روشن و `public/Dark-Logo.png` روی سطح تیره استفاده شود؛ تصویر لوگو به‌صورت local asset ارائه شود.
- موبایل‌محور برای کار کنار دستگاه، دسکتاپ‌محور برای مدیریت و گزارش.
- شروع با کار اصلی: امروز چه بازرسی، عیب و کاری نیاز به اقدام دارد؟
- یک فرم بازرسی باید کوتاه، قابل‌خواندن و مناسب کار با یک دست و دستکش سبک باشد.
- وضعیت فقط با رنگ نشان داده نشود؛ متن و آیکون و برچسب دسترس‌پذیر نیز داشته باشد.
- طراحی در نور زیاد و نمایشگر معمولی خوانا باشد؛ tap targetها بزرگ و خطاها قابل‌اقدام باشند.
- نمایش شبکه و sync status در نقاط نیاز، نه فقط صفحهٔ تنظیمات.
- انیمیشن غیرضروری نباشد؛ احترام به reduced motion.
- هدف دسترس‌پذیری WCAG 2.2 AA؛ با صفحه‌کلید، focus واضح، label فرم و contrast مناسب.
- پیام خطا دقیق باشد اما جزئیات tenant یا دسترسی غیرمجاز را افشا نکند.

### ناوبری پیشنهادی

**کاربر موبایل:** خانه، اسکن QR، بازرسی‌های من، کارهای من، حساب. گزینه‌های پنهان در منوی بیشتر.  
**مدیر شعبه:** داشبورد، تجهیزات، برنامه‌ها، بازرسی‌ها، عیب‌ها، کارهای تعمیراتی، گزارش، اعضا/تنظیمات شعبه.  
**مدیر مجموعه:** تصویر تجمیعی، شعبه‌ها، تجهیزات، قالب‌ها، زمان‌بندی، کاربران و نقش‌ها، گزارش‌ها، تنظیمات سازمان.  
**مدیر پلتفرم:** نمای سراسری، سازمان‌ها، شعبه‌ها، مدیران مشتری، نقش‌های پلتفرمی، تنظیمات پلتفرم، audit.  
نمای مدیر پلتفرم باید بصری از محیط tenant جدا باشد و نوار واضح «مدیریت پلتفرم» داشته باشد.

### صفحه‌های لازم MVP

1. ورود، بازیابی نشست و تغییر رمز اولیه مدیر.
2. انتخاب سازمان/شعبه برای کاربر دارای عضویت چندگانه.
3. صفحهٔ خانه با کار امروز، عقب‌افتادگی، sync و رخدادهای اخیر متناسب با نقش.
4. اسکن QR با fallback جست‌وجوی شناسه.
5. فهرست و جزئیات تجهیز: مشخصات، QR، اسناد پایه و timeline.
6. فرم چک‌لیست با save draft، ثبت نهایی پس از sync، عکس و پاسخ نامنطبق.
7. تاریخچهٔ بازرسی و جزئیات هر پاسخ.
8. فهرست/جزئیات عیب و جریان اقدام اصلاحی.
9. فهرست/جزئیات work order و ثبت اقدام/پیوست.
10. سازنده و نسخه‌های چک‌لیست پایه.
11. برنامهٔ بازرسی و نمای سررسیدها.
12. مدیریت سازمان، شعبه، عضویت، نقش و مجوز.
13. بخش SUPERADMIN برای ایجاد مجموعه، شعبه و مدیر سازمان.
14. گزارش و خروجی با محدودهٔ مجوزمند.
15. وضعیت اتصال، صف آفلاین و خطاهای قابل حل.

در صفحهٔ تجهیزات، عنوان و شرح در ابتدای هدر و کنترل‌ها در ردیفی زیر آن با چینش راست‌چین قرار می‌گیرند؛ ترتیب دیداری از راست به چپ افزودن، اسکن QR، فیلتر و جست‌وجو است. فهرست تجهیزات و دسته‌بندی‌ها با ردیف‌های تخت و جداکننده نمایش داده می‌شوند، نه کارت‌های مستقل. افزودن و ویرایش در مودال انجام می‌شود؛ فهرست جدا از صفحهٔ جزئیاتِ پرونده است. فیلترها باید مشخصات ثبت‌شده، دسته، وضعیت، ثبت‌کننده و بازهٔ زمانی ثبت/ویرایش را پوشش دهند. بایگانی تجهیز حذف فیزیکی نیست: پیش از تأیید، وابستگی‌های مستقیم نشان داده می‌شوند و بازرسی‌ها، عیب‌ها، برنامه‌ها و کارهای تعمیراتی حفظ می‌شوند.

مدیریت دسته‌بندی‌ها صفحهٔ مستقل مجموعه‌ای است و از صفحهٔ تجهیزات جدا می‌ماند. آرشیو دسته‌بندی، پیوند تجهیزات موجود را نگه می‌دارد، اما دسته را از گزینه‌های ساخت و ویرایش پرونده‌های جدید خارج می‌کند. مدیریت و آرشیو دسته‌بندی فقط با مجوز سروری در سطح مجموعه انجام می‌شود.

### سیستم طراحی

- توکن برای رنگ semantic، فاصله، شعاع، سایه، typography و breakpoint.
- رنگ وضعیت نمونه: موفق/انجام‌شده، هشدار/نزدیک موعد، خطر/نیازمند اقدام، خنثی/اطلاعات؛ مقدار واقعی از theme کنترل شود.
- فونت فارسی وب‌امن با مجوز مناسب و fallback سیستمی.
- الگوی یکسان برای empty state، loading skeleton، error, offline, permission denied و confirmation.
- UI هیچ permission یا scope واقعی را اختراع نکند؛ navigation از مجوز مؤثر ساخته شود و endpoint دوباره کنترل کند.

## ۸. API، اعتبارسنجی و قواعد کسب‌وکار

- هر ورودی بیرونی از schema مشخص عبور کند؛ ورودی فرم، query، فایل و webhook همگی ورودی نامطمئن‌اند.
- هر عملیات mutation یک service واضح و authorization check دارد.
- انتقال وضعیت از state machine/domain method عبور کند؛ تغییر مستقیم status از UI مجاز نیست.
- پاسخ API شامل شناسهٔ درخواست و خطای قابل‌اقدام باشد؛ stack trace تولیدی به کاربر نمایش داده نشود.
- تاریخ کلاینت برای حسابرسی کافی نیست؛ server_received_at ثبت شود.
- pagination، sort و فیلتر allowlist داشته باشند و scope سازمان را حفظ کنند.
- exportها در background یا با سقف اندازه و audit کنترل شوند؛ URLهای export خصوصی و منقضی باشند.
- webhook ورودی امضا، timestamp، replay protection و idempotency داشته باشد.
- قرارداد API از اول versioned/typed باشد؛ نام endpoint یا Server Action به معنی مجوز نیست.

## ۹. تقویم، زبان و قالب پول

- timestamp در DB UTC، نمایش با timezone ذخیره‌شدهٔ شعبه یا ترجیح معتبر کاربر.
- Jalali صرفاً در لایهٔ نمایش/ورودی با parsing دقیق استفاده شود؛ در API قالب ISO یا timestamp استاندارد باشد.
- پشتیبانی locale با کلیدهای ترجمه، نه رشتهٔ فارسی پراکنده در منطق.
- فارسی RTL زبان اصلی؛ انگلیسی برای label و layout از نسخهٔ اول آماده باشد.
- منطقهٔ زمانی پایهٔ کسب‌وکار Asia/Tehran به شکل تنظیم‌شده و قابل تغییر؛ از offset ثابت استفاده نکن.
- مبلغ در واحد integer و همراه currency code ذخیره شود؛ تومان/ریال را مخلوط نکن.
- اعداد، جداکننده و قالب تاریخ در UI محلی‌سازی شوند؛ کلیدهای داخلی و API با قالب locale-neutral بمانند.

## ۱۰. DevOps و عملیات

- فایل env.example تنها نام متغیر و placeholder دارد؛ secret واقعی در Git ممنوع.
- migration در هر محیط قابل تکرار و با مسیر deploy مستند باشد.
- seed توسعه‌ای فقط دادهٔ ساختگی بسازد؛ seed تولیدی Superadmin جدا، idempotent و صریح اجرا شود.
- محیط local، test، staging و production تفکیک شوند.
- build production بدون secret مناسب fail شود، نه اینکه credential پیش‌فرض بسازد.
- health check، backup، restore test، پایش latency/error، صف ایمیل و وضعیت فضای فایل وجود داشته باشد.
- log JSON با request_id، actor_id داخلی، tenant scope در حد لازم و redaction داشته باشد.
- معماری deployment از providerهای میزبانی و SMS/پرداخت مستقل بماند.
- استقرار داخل ایران یا بیرون ایران بر اساس کیفیت دسترسی، پرداخت، قوانین جاری، حریم خصوصی و مشتریان تصمیم‌گیری شود؛ از فرض ثابت دربارهٔ دسترسی سرویس بیرونی پرهیز شود.

## ۱۱. کیفیت و معیارهای پذیرش

### حداقل تست‌های خودکار

- واحد: قواعد state machine و محاسبهٔ موعد.
- integration: query و mutation در مرز organization و branch.
- authorization: مجاز، غیرمجاز، عضویت تعلیق‌شده، نقش شعبهٔ دیگر و Superadmin wildcard.
- migration/bootstrap: ساخت schema از صفر، تکرار seed بدون تغییر ناخواسته، دریافت permission آینده از wildcard.
- offline: duplicate retry، conflict، شکست اتصال و ادامهٔ صف.
- E2E: ورود مدیر، ساخت مجموعه و شعبه، دعوت کاربر، ساخت تجهیز، اسکن یا ورود شناسه، ثبت بازرسی، ایجاد عیب و بستن کار.
- بررسی دسترس‌پذیری و RTL در viewport موبایل و دسکتاپ.

### معیار پذیرش MVP

- Superadmin فقط از مسیر پلتفرم وارد شود و تمام عملیات مدیریتی او audit شوند.
- Superadmin بتواند مجموعه، شعبه و اولین مدیر مجموعه را بدون دستکاری دیتابیس بسازد.
- role جدید و permission جدید مطابق قواعد scope کار کنند؛ wildcard Superadmin permission تازه را بدون تخصیص دستی بگیرد.
- هیچ کاربر عملیاتی با تغییر URL یا payload به سازمان یا شعبهٔ خارج از scope دسترسی نگیرد.
- کاربر بتواند در اتصال ضعیف یک بازرسی را ذخیرهٔ محلی کند، وضعیت انتظار sync را ببیند و بعد از اتصال بدون duplicate ثبت کند.
- هر ایراد ساخته‌شده به یک دستگاه و شعبهٔ مجاز وصل باشد؛ کار تعمیراتی قابل واگذاری و پیگیری باشد.
- صفحه‌های کلیدی فارسی/RTL باشند، خطا و وضعیت خالی داشته باشند و روی موبایل قابل استفاده باشند.
- محیط تازه با دستورالعمل مخزن نصب، migration، seed آزمایشی، SUPERADMIN bootstrap، تست و build شود.

## ۱۲. ریسک‌ها و کنترل‌ها

| ریسک | کنترل |
|---|---|
| نشت دادهٔ tenant | scope server-side، constraint رابطه، تست cross-tenant، RLS دفاعی |
| Superadmin ناامن | جداسازی auth/session، MFA، راز اولیهٔ محیطی، audit، انقضا و recovery |
| دادهٔ آفلاین ناسازگار | idempotency، نسخه schema، تعارض قابل بازبینی، pending روشن |
| تصور گواهی ایمنی از خروجی | متن صریح مسئولیت انسانی، عدم صدور ادعای انطباق |
| اتصال ناپایدار ابزار بیرونی | adapter و queue و fallback |
| پیچیدگی بیش‌ازحد MVP | modular monolith و roadmap به‌عنوان backlog، نه scope فوری |
| اعتماد کاذب به AI | خروجی پیشنهاد با منبع و تأیید انسانی؛ ممنوعیت تصمیم ایمنی خودکار |
| تغییر قوانین/استاندارد | مالک محتوا و تاریخ اعتبار فرم، بازبینی متخصص و ثبت نسخه |

## ۱۳. منابع فنی رسمی برای بررسی در زمان ساخت

- راهنمای PWA در Next.js: https://nextjs.org/docs/app/guides/progressive-web-apps
- دسترسی دوربین در MDN: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- Service Worker در MDN: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
- Row Security در PostgreSQL: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- Better Auth Phone Number plugin: https://better-auth.com/docs/plugins/phone-number
- ParsGreen SDK API reference: https://www.nuget.org/packages/PARSGREEN.CORE
- Next.js font optimization: https://nextjs.org/docs/app/getting-started/fonts
- مرورگرها و نسخه‌های هدف باید پیش از تصمیم نهایی PWA و push در ماتریس سازگاری ثبت شوند؛ این رفتارها وابسته به مرورگر، دستگاه، HTTPS و مجوز کاربر هستند.

## ۱۴. نمای اجراشدهٔ MVP

این بخش وضعیت کد موجود را از پیشنهادهای عمومی بخش‌های قبل جدا می‌کند؛ مواردی که اینجا نیامده‌اند خودکار بخشی از MVP محسوب نمی‌شوند.

- برنامه به‌صورت modular monolith در Next.js App Router اجرا می‌شود. PostgreSQL 15+ با migration checksumدار استفاده می‌شود؛ تغییر migration اعمال‌شده باید migration تازه باشد.
- Better Auth در دو پیکربندی مستقل برای کاربران عملیاتی و مدیران پلتفرم به کار رفته است. جدول‌های کاربر، session، account و verification و cookie prefix آن‌ها جداست. مدیر پلتفرم می‌تواند TOTP فعال کند؛ الزام سیاستی MFA به استقرار واگذار شده است.
- برای عملیات Better Auth در Server Actionهای Next.js، افزونهٔ `nextCookies` باید آخرین افزونهٔ پیکربندی باشد تا `Set-Cookie` پاسخ در مرورگر ثبت شود.
- تغییر رمز مدیر پلتفرم نشست فعلی را نگه می‌دارد و نشست‌های دیگر را باطل می‌کند؛ در Server Action از چرخاندن کوکی نشست فعلی پرهیز شود تا پاسخ فرم به `Set-Cookie` تازه وابسته نباشد.
- چون تولید UUID در پیکربندی PostgreSQL به دیتابیس واگذار شده، ستون `id` تمام جدول‌های Better Auth باید default پایگاه داده داشته باشد. migration `0003_auth_id_defaults.sql` برای حفظ نوع `text` از `gen_random_uuid()::text` استفاده می‌کند؛ migrationهای اعمال‌شده و `0001_initial.sql` بازنویسی نمی‌شوند.
- ورود عملیاتی فقط با شمارهٔ همراه ثبت‌شده و OTP شش‌رقمی Better Auth انجام می‌شود. provider سمت سرور ParsGreen و متغیر `PARSGREEN_API_TOKEN` را مصرف می‌کند؛ امکان signup عمومی یا رمز عملیاتی فعال نیست. شمارهٔ همراه با migration افزوده‌شده E.164/یکتاست. sink بدون ارسال SMS فقط برای E2E محلی فعال می‌شود.
- مدیر پلتفرم، مدیر مجموعه را هنگام ایجاد سازمان با شمارهٔ همراه provision می‌کند؛ مدیر مجموعه می‌تواند مدیر شعبه را فقط برای یک شعبه تعریف کند و مدیر شعبه فقط نقش‌های عادی همان شعبه را تخصیص می‌دهد. تعلیق حساب سراسری فقط از پنل مجاز پلتفرم انجام می‌شود و نشست‌ها را revoke می‌کند.
- لوگوهای مالک محصول در همهٔ shellهای عمومی، عملیاتی و پلتفرم مصرف می‌شوند. Vazirmatn Variable از dependency محلی package و با fallbackهای CSS ارائه می‌شود.
- scope عملیاتی از session و membership پایگاه داده حل می‌شود. permission، membership و branch membership پیش از mutation/query کنترل می‌شوند و FKهای مرکب اتصال بین سازمان/شعبه را محدود می‌کنند. PostgreSQL RLS در این پیاده‌سازی فعال نیست.
- SUPERADMIN با فرمان `npm run platform:bootstrap` و متغیرهای اپراتور ساخته می‌شود. نقش دارای `grants_all_permissions` است و چک‌کردن wildcard در permission helper انجام می‌شود.
- آفلاین فقط بازرسی‌ها و عکس همراه آن‌ها را در IndexedDB نگه می‌دارد. شناسهٔ event یکتا، schema version، زمان دستگاه و زمان دریافت سرور وجود دارد. ثبت محلی تا پاسخ server صریحاً synced نمایش داده نمی‌شود. service worker پاسخ tenant را cache نمی‌کند.
- فایل خصوصی با provider فایل‌سیستم محلی و توکن دسترسی پنج‌دقیقه‌ای ارائه می‌شود. این adapter برای چند replica مناسب نیست تا provider پایدار object storage نصب شود.
- خروجی CSV scoped و auditشده است. PDF، پیام‌رسانی بازیابی رمز، ارسال اعلان، ترجمهٔ کامل انگلیسی، sync background، RLS، و پیوست تصویر work order در backlog می‌مانند.
- delivery زندهٔ SMS به اعتبار ParsGreen نیاز دارد. provider با fake fetch آزموده می‌شود؛ ارسال پیامک واقعی در CI انجام نمی‌شود. بازیابی مدیران پلتفرم همچنان operator-mediated است.
- work order با مسئول، اولویت، موعد، وضعیت‌های محدود و یادداشت تکمیل دنبال می‌شود؛ تکمیل یا بستن workflow هیچ ادعای ایمنی یا اجازهٔ بهره‌برداری ایجاد نمی‌کند.
- پوشش خودکار شامل testهای واحد و DB boundary و یک مسیر Playwright از ساخت سازمان تا بستن work order است؛ migration از دیتابیس تازه، bootstrap و آزمون DB/E2E فقط زمانی تأیید می‌شوند که PostgreSQL قابل‌نوشتن و secretهای اپراتور حاضر باشند.

راهنمای نصب، متغیرهای محیطی، فرمان‌های دقیق و gapهای عملیاتی در `README.md` است. فرض‌ها و وضعیت راستی‌آزمایی هر rollout در `IMPLEMENTATION_PLAN.md` به‌روز می‌شود.
