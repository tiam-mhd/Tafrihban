import Link from "next/link";

export default function HomePage() {
  return (
    <main className="public-page landing-page">
      <header className="public-header"><Link href="/" className="brand-lockup"><span className="brand-mark">ت</span><span>تفریح‌بان<small>بازرسی و نگهداری تجهیزات</small></span></Link><Link href="/platform/login" className="quiet-link">مدیریت پلتفرم</Link></header>
      <section className="hero-grid">
        <div className="hero-copy"><span className="eyebrow eyebrow-pill">برای کار واقعی در محل تجهیز</span><h1>هر تجهیز، یک پروندهٔ روشن.<br /><em>هر اقدام، قابل پیگیری.</em></h1><p>بازرسی‌های زمان‌بندی‌شده، ثبت ایراد و پیگیری تعمیر در یک فضای امن و فارسی‌محور؛ حتی وقتی اینترنت پایدار نیست.</p><div className="hero-actions"><Link href="/login" className="button button-primary button-large">ورود کاربر مجموعه</Link><Link href="/platform/login" className="text-link">ورود مدیر پلتفرم</Link></div><div className="hero-assurance"><span>✓ محدودهٔ جدا برای هر سازمان</span><span>✓ صف آفلاین با تأیید سرور</span><span>✓ تصمیم ایمنی با متخصص انسانی</span></div></div>
        <div className="hero-art" aria-label="نمای شماتیک مسیر بازرسی" role="img"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="equipment-illustration"><div className="tower" /><div className="wheel"><span /><i /><i /><i /><i /></div><div className="asset-card"><span className="mini-tag">پروندهٔ تجهیز</span><strong>ثبت و پیگیری</strong><small>بازرسی · عیب · تعمیر</small></div><div className="check-card"><span className="check-dot">✓</span><span>اقدام اصلاحی ثبت شد</span></div></div></div>
      </section>
      <section className="feature-strip"><article><span>۰۱</span><h2>پروندهٔ تجهیز</h2><p>شناسهٔ QR غیرحساس، مشخصات پایه و تاریخچه در محدودهٔ شعبه.</p></article><article><span>۰۲</span><h2>بازرسی نسخه‌دار</h2><p>چک‌لیست و پاسخ‌ها همراه توضیح و مدرک، با ثبت وضعیت همگام‌سازی.</p></article><article><span>۰۳</span><h2>اقدام مسئول‌دار</h2><p>عیب، مسئول، اولویت و موعد تا ثبت تکمیل و بازبینی انسانی.</p></article></section>
      <footer className="public-footer"><span>تفریح‌بان گواهی ایمنی صادر نمی‌کند و مجوز بهره‌برداری نمی‌دهد.</span><span>© تفریح‌بان</span></footer>
    </main>
  );
}
