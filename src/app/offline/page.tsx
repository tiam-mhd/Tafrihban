import Link from "next/link";

export default function OfflinePage() {
  return <main className="public-page"><section className="public-card offline-card"><span className="brand-mark">ت</span><span className="eyebrow">حالت آفلاین</span><h1>این صفحه در دسترس نیست</h1><p>پوستهٔ برنامه آماده است، اما صفحه‌های سازمانی و اطلاعات تجهیزات برای حفاظت از داده‌ها در کش مشترک ذخیره نمی‌شوند.</p><p>بازرسی‌های ذخیره‌شده را پس از اتصال از صف همگام‌سازی ارسال کنید.</p><Link className="button button-primary" href="/">بازگشت به خانه</Link></section></main>;
}
