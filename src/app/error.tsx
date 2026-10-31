"use client";

import Link from "next/link";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="public-page"><section className="loading-card" role="alert"><span className="eyebrow">خطای غیرمنتظره</span><h1>این صفحه بارگذاری نشد</h1><p>اطلاعات عملیاتی نمایش داده نشد. دوباره تلاش کنید یا به صفحهٔ آغاز برگردید.</p><div className="form-actions"><button className="button button-primary" onClick={() => reset()}>تلاش دوباره</button><Link className="button button-secondary" href="/">صفحهٔ آغاز</Link></div></section></main>;
}
