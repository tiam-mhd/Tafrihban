import { pool } from "@/db";
import { PlatformShell } from "@/components/operational-shell";
import { EmptyState, FormNotice } from "@/components/empty-state";
import { updatePlatformSettingAction } from "@/app/platform/actions";
import { requirePlatformActor, hasPlatformPermission } from "@/server/auth-guards";

type Search = Promise<{ error?: string; saved?: string }>;

export default async function PlatformSettingsPage({ searchParams }: { searchParams: Search }) {
  const actor = await requirePlatformActor();
  const query = await searchParams;
  if (!(await hasPlatformPermission(actor, "platform_settings.manage"))) return <PlatformShell title="تنظیمات" actorName={actor.name} actorId={actor.id}><p className="notice notice-warning">اجازهٔ تغییر تنظیمات را ندارید.</p></PlatformShell>;
  const settings = await pool.query<{ key: string; value: unknown; updated_at: Date }>("SELECT key, value, updated_at FROM platform_settings ORDER BY key", []);
  return <PlatformShell title="تنظیمات پلتفرم" actorName={actor.name} actorId={actor.id}>
    <FormNotice searchParams={query} /><section className="panel"><h2>کلیدهای تنظیم‌شده</h2>{!settings.rows.length ? <EmptyState title="تنظیمی ثبت نشده">تنظیم‌های سراسری را از فرم پایین ایجاد کنید.</EmptyState> : <div className="table-wrap"><table className="data-table"><thead><tr><th>کلید</th><th>مقدار متنی</th><th>آخرین تغییر</th></tr></thead><tbody>{settings.rows.map((setting) => <tr key={setting.key}><td dir="ltr">{setting.key}</td><td>{String(setting.value)}</td><td>{setting.updated_at.toISOString()}</td></tr>)}</tbody></table></div>}</section>
    <section className="panel narrow-panel"><h2>ثبت یا ویرایش تنظیم</h2><form action={updatePlatformSettingAction} className="form-stack"><label className="field-label">کلید<input name="key" required minLength={3} maxLength={81} pattern="[a-z][a-z0-9_.-]{2,80}" dir="ltr" /></label><label className="field-label">مقدار<input name="value" required maxLength={500} /></label><label className="field-label">دلیل تغییر<input name="reason" required minLength={8} maxLength={300} /></label><button className="button button-primary" type="submit">ذخیرهٔ تنظیم</button></form></section>
  </PlatformShell>;
}
