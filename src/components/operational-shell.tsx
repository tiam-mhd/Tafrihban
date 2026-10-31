import Link from "next/link";
import type { ReactNode } from "react";
import type { OperationalScope } from "@/server/auth-guards";
import { SignOutButton } from "@/components/sign-out-button";
import { OfflineStatus } from "@/components/offline-status";
import { BrandLogo } from "@/components/brand-logo";
import { pool } from "@/db";

const links = [
  ["خانه", "/app", "dashboard.read"],
  ["تجهیزات", "/app/equipment", "equipment.read"],
  ["چک‌لیست‌ها", "/app/checklists", "checklist.read"],
  ["برنامهٔ بازرسی", "/app/schedules", "inspection_schedule.manage"],
  ["بازرسی‌ها", "/app/inspections", "inspection.read"],
  ["عیب‌ها", "/app/defects", "defect.manage"],
  ["کارهای تعمیراتی", "/app/work-orders", "work_order.manage"],
  ["اعضا", "/app/members", "member.manage"],
  ["نقش‌ها", "/app/roles", "role.manage"],
  ["شعبه‌ها", "/app/branches", "branch.manage"],
  ["گزارش‌ها", "/app/reports", "report.export"],
] as const;

export async function OperationalShell({ scope, children, title }: { scope: OperationalScope; children: ReactNode; title: string }) {
  const params = `organizationId=${encodeURIComponent(scope.organizationId)}&branchId=${encodeURIComponent(scope.branchId)}`;
  const granted = await pool.query<{ permission_key: string }>(
    `SELECT DISTINCT rp.permission_key
       FROM membership_role_assignments a
       JOIN operational_roles r ON r.id = a.role_id AND r.status = 'active'
       JOIN operational_role_permissions rp ON rp.role_id = r.id
      WHERE a.membership_id = $1 AND a.organization_id = $2
        AND ((a.scope_type = 'organization' AND a.branch_id IS NULL)
          OR (a.scope_type = 'branch' AND a.branch_id = $3))`,
    [scope.membershipId, scope.organizationId, scope.branchId],
  );
  const permissionKeys = new Set(granted.rows.map((row) => row.permission_key));
  return (
    <div className="workspace">
      <aside className="sidebar">
        <Link href={`/app?${params}`} className="brand-lockup"><BrandLogo appearance="teal" /><span>تفریح‌بان<small>پروندهٔ عملیات</small></span></Link>
        <div className="scope-card"><span className="eyebrow">محدودهٔ فعال</span><strong>{scope.organizationName}</strong><span>{scope.branchName}</span><Link href="/app/select-scope">تغییر مجموعه یا شعبه</Link></div>
        <nav className="side-nav" aria-label="ناوبری اصلی">
          {links.filter(([, , permission]) => permissionKeys.has(permission)).map(([label, href]) => <Link key={href} href={`${href}?${params}`}>{label}</Link>)}
        </nav>
        <div className="sidebar-bottom"><OfflineStatus /><SignOutButton accountId={scope.actor.id} platform={false} /></div>
      </aside>
      <main className="workspace-main">
        <header className="page-top"><div><span className="eyebrow">{scope.branchName}</span><h1>{title}</h1></div><span className="avatar">{scope.actor.name.slice(0, 1)}</span></header>
        {children}
        <footer className="safety-note">تفریح‌بان ابزار ثبت و پیگیری است؛ تصمیم بهره‌برداری با متخصص انسانی مجموعه است.</footer>
      </main>
    </div>
  );
}

export async function PlatformShell({ children, title, actorName, actorId }: { children: ReactNode; title: string; actorName: string; actorId: string }) {
  const granted = await pool.query<{ key: string }>(
    `SELECT DISTINCT p.key FROM platform_admin_role_assignments a
       JOIN platform_admin_roles r ON r.id = a.role_id AND r.status = 'active'
       LEFT JOIN platform_role_permissions p ON p.role_id = r.id
      WHERE a.platform_admin_id = $1`, [actorId],
  );
  const rows = await pool.query<{ grants_all_permissions: boolean }>(
    `SELECT r.grants_all_permissions FROM platform_admin_role_assignments a
       JOIN platform_admin_roles r ON r.id = a.role_id AND r.status = 'active'
      WHERE a.platform_admin_id = $1`, [actorId],
  );
  const all = rows.rows.some((row) => row.grants_all_permissions);
  const keys = new Set(granted.rows.map((row) => row.key).filter((key): key is string => Boolean(key)));
  const can = (key: string) => all || keys.has(key);
  return (
    <div className="platform-frame">
      <header className="platform-top">
        <Link href="/platform" className="brand-lockup"><BrandLogo appearance="platform" /><span>مدیریت پلتفرم<small>تفریح‌بان</small></span></Link>
        <div className="platform-top-right"><span>{actorName}</span><SignOutButton platform accountId="" /></div>
      </header>
      <div className="platform-body">
        <aside className="platform-nav" aria-label="مدیریت پلتفرم">
          <Link href="/platform">نمای کلی</Link>
          {can("organization.read") && <Link href="/platform/organizations">سازمان‌ها</Link>}
          {can("operational_account.manage") && <Link href="/platform/accounts">مدیریت حساب‌های عملیاتی</Link>}
          {can("platform_admin.manage") && <Link href="/platform/admins">مدیران پلتفرم</Link>}
          {can("platform_admin.manage") && <Link href="/platform/roles">نقش‌های پلتفرم</Link>}
          {can("platform_settings.manage") && <Link href="/platform/settings">تنظیمات</Link>}
          {can("platform_audit.read") && <Link href="/platform/audit">دفتر حسابرسی</Link>}
          <Link href="/platform/security/change-password">تغییر رمز مدیر</Link>
          <Link href="/platform/security">امنیت مدیر</Link>
        </aside>
        <main className="platform-main"><header className="page-top"><div><span className="eyebrow">مدیریت سراسری</span><h1>{title}</h1></div><span className="pill pill-danger">محیط پلتفرم</span></header>{children}</main>
      </div>
    </div>
  );
}
