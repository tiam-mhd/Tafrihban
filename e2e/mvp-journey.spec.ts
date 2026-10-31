import { randomUUID } from "node:crypto";
import { Pool, type QueryResultRow } from "pg";
import { expect, test } from "@playwright/test";

const enabled = Boolean(
  process.env.DATABASE_URL && process.env.E2E_SUPERADMIN_EMAIL && process.env.E2E_SUPERADMIN_PASSWORD && process.env.TAFRIHBAN_TEST_OTP_SINK === "1",
);

test.describe("مسیر اصلی نسخهٔ اولیه", () => {
  test.skip(!enabled, "برای E2E، DATABASE_URL، حساب E2E پلتفرم و TAFRIHBAN_TEST_OTP_SINK=1 را در محیط محلی تنظیم کنید.");

  test("مدیر مجموعه می‌سازد، بازرسی را ثبت می‌کند و کار تعمیراتی را می‌بندد", async ({ browser }) => {
    const connectionString = process.env.DATABASE_URL!;
    const database = new Pool({ connectionString, max: 2 });
    const platformContext = await browser.newContext();
    const platformPage = await platformContext.newPage();
    const nonce = randomUUID().replaceAll("-", "").slice(0, 10);
    const slug = `e2e-${nonce}`;
    const organizationName = `مجموعهٔ آزمون ${nonce}`;
    const branchName = `شعبهٔ آزمون ${nonce}`;
    const managerPhone = `+989${Math.floor(Math.random() * 1_000_000_000).toString().padStart(9, "0")}`;
    const managerName = `بازرس آزمون ${nonce}`;
    let organizationId: string | undefined;

    try {
      await signIn(platformPage, "/platform/login", process.env.E2E_SUPERADMIN_EMAIL!, process.env.E2E_SUPERADMIN_PASSWORD!);
      await expect(platformPage).toHaveURL(/\/platform(?:\?.*)?$/);
      await expect(platformPage.locator("html")).toHaveAttribute("dir", "rtl");
      await platformPage.goto("/platform/organizations/new");
      await platformPage.getByLabel("نام سازمان").fill(organizationName);
      await platformPage.getByLabel("شناسهٔ URL").fill(slug);
      await platformPage.getByLabel("نام نخستین شعبه").fill(branchName);
      await platformPage.getByLabel("کد شعبه").fill(`E2E${nonce.slice(0, 6).toUpperCase()}`);
      await platformPage.getByLabel("نام مدیر").fill(managerName);
      await platformPage.getByLabel("شمارهٔ همراه مدیر").fill(managerPhone);
      await platformPage.getByRole("button", { name: "ساخت سازمان، شعبه و مدیر" }).click();
      await expect(platformPage).toHaveURL(/\/platform\/organizations\/[0-9a-f-]+\?created=1/);

      const created = await database.query<{ organization_id: string; branch_id: string }>(
        `SELECT o.id AS organization_id, b.id AS branch_id
           FROM organizations o JOIN branches b ON b.organization_id = o.id
          WHERE o.slug = $1`, [slug],
      );
      expect(created.rowCount).toBe(1);
      organizationId = created.rows[0]!.organization_id;
      const branchId = created.rows[0]!.branch_id;
      const user = await database.query<{ id: string }>("SELECT id FROM users WHERE phone_number = $1", [managerPhone]);
      expect(user.rowCount).toBe(1);
      const userId = user.rows[0]!.id;

      const operationalContext = await browser.newContext();
      try {
        const page = await operationalContext.newPage();
        await page.goto("/login");
        await page.getByLabel("شمارهٔ همراه ثبت‌شده").fill(managerPhone);
        await page.getByRole("button", { name: "دریافت کد ورود" }).click();
        await expect(page.getByLabel("کد یک‌بارمصرف شش‌رقمی")).toBeVisible();
        const verification = await waitForRow<{ value: string }>(database,
          "SELECT value FROM user_verifications WHERE identifier = $1 AND expires_at > now() ORDER BY created_at DESC LIMIT 1",
          [managerPhone],
        );
        await page.getByLabel("کد یک‌بارمصرف شش‌رقمی").fill(verification.value.split(":")[0]!);
        await page.getByRole("button", { name: "تأیید و ورود" }).click();
        await expect(page).toHaveURL(/\/app\?organizationId=/);

        const validScope = `organizationId=${organizationId}&branchId=${branchId}`;
        await page.goto(`/app/equipment?organizationId=${organizationId}&branchId=${randomUUID()}`);
        await expect(page).toHaveURL(/\/app\/select-scope/);

        const categoryName = `دستهٔ ${nonce}`;
        await page.goto(`/app/equipment?${validScope}`);
        await page.getByLabel("نام دسته‌بندی تازه").fill(categoryName);
        await page.getByRole("button", { name: "ثبت دسته‌بندی" }).click();
        await expect(page.getByText(categoryName)).toBeVisible();

        const assetCode = `E2E-${nonce.toUpperCase()}`;
        const equipmentName = `تجهیز آزمون ${nonce}`;
        await page.getByLabel("نام تجهیز").fill(equipmentName);
        await page.getByLabel("کد دارایی").fill(assetCode);
        await page.getByLabel("دسته‌بندی", { exact: true }).selectOption({ label: categoryName });
        await page.getByRole("button", { name: "ساخت پرونده و QR" }).click();
        await expect(page.getByText(assetCode)).toBeVisible();

        const equipment = await database.query<{ id: string }>(
          "SELECT id FROM equipment WHERE organization_id = $1 AND branch_id = $2 AND asset_code = $3",
          [organizationId, branchId, assetCode],
        );
        expect(equipment.rowCount).toBe(1);
        const equipmentId = equipment.rows[0]!.id;

        const checklistName = `چک‌لیست آزمون ${nonce}`;
        await page.goto(`/app/checklists?${validScope}`);
        await page.getByLabel("عنوان").fill(checklistName);
        await page.getByLabel("موارد بازرسی، هر مورد در یک خط").fill("بررسی حفاظ‌ها\nبررسی توقف اضطراری");
        await page.getByRole("button", { name: "انتشار نسخهٔ ۱" }).click();
        await expect(page.getByText(checklistName)).toBeVisible();
        const questions = await database.query<{ version_id: string; id: string }>(
          `SELECT v.id AS version_id, q.id
             FROM checklist_templates t JOIN checklist_template_versions v ON v.template_id = t.id AND v.organization_id = t.organization_id
             JOIN checklist_questions q ON q.template_version_id = v.id AND q.organization_id = v.organization_id
            WHERE t.organization_id = $1 AND t.name = $2 ORDER BY q.position`, [organizationId, checklistName],
        );
        expect(questions.rowCount).toBe(2);

        const dueAt = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);
        await page.goto(`/app/schedules?${validScope}`);
        await page.getByLabel("تجهیز").selectOption(equipmentId);
        await page.getByLabel("نسخهٔ منتشرشدهٔ چک‌لیست").selectOption(questions.rows[0]!.version_id);
        await page.getByLabel("مسئول اختیاری").selectOption(userId);
        await page.getByLabel("موعد نخست (زمان محلی این شعبه)").fill(dueAt);
        await page.getByRole("button", { name: "ثبت برنامه" }).click();
        const schedule = await database.query<{ id: string }>(
          "SELECT id FROM inspection_schedules WHERE organization_id = $1 AND branch_id = $2 AND equipment_id = $3 AND checklist_version_id = $4",
          [organizationId, branchId, equipmentId, questions.rows[0]!.version_id],
        );
        expect(schedule.rowCount).toBe(1);

        await page.goto(`/app/inspections/new?equipmentId=${equipmentId}&checklistVersionId=${questions.rows[0]!.version_id}&scheduleId=${schedule.rows[0]!.id}&${validScope}`);
        await page.getByRole("radio", { name: "مورد دارد" }).first().check();
        await page.getByLabel("شرح مورد نامنطبق").fill("آزمون E2E: ثبت یک مورد برای چرخهٔ عیب و تعمیر.");
        await page.getByRole("radio", { name: "مطابق" }).last().check();
        await page.getByRole("button", { name: "ذخیره و ارسال بازرسی" }).click();

        const inspection = await waitForRow<{ id: string }>(database,
          "SELECT id FROM inspections WHERE organization_id = $1 AND branch_id = $2 AND equipment_id = $3 ORDER BY created_at DESC LIMIT 1",
          [organizationId, branchId, equipmentId],
        );
        const defect = await waitForRow<{ id: string }>(database,
          "SELECT id FROM defects WHERE organization_id = $1 AND branch_id = $2 AND inspection_id = $3 LIMIT 1",
          [organizationId, branchId, inspection.id],
        );

        await page.goto(`/app/work-orders?${validScope}`);
        await page.getByLabel("عیب").selectOption(defect.id);
        await page.getByLabel("مسئول").selectOption(userId);
        await page.getByLabel("اولویت").selectOption("high");
        await page.getByLabel("دستورکار").fill("رسیدگی انسانی و بررسی فنی مورد ثبت‌شده.");
        await page.getByRole("button", { name: "ساخت کار تعمیراتی" }).click();
        const workOrder = await waitForRow<{ id: string; status: string }>(database,
          "SELECT id, status FROM work_orders WHERE organization_id = $1 AND branch_id = $2 AND defect_id = $3",
          [organizationId, branchId, defect.id],
        );
        expect(workOrder.status).toBe("open");

        await page.getByRole("button", { name: "پذیرش کار" }).click();
        await expect.poll(async () => getWorkOrderStatus(database, workOrder.id)).toBe("accepted");
        await page.getByRole("button", { name: "شروع رسیدگی" }).click();
        await page.getByLabel("مدرک/یادداشت تکمیل").fill("قطعه بررسی شد و نتیجه به مسئول شعبه تحویل شد.");
        await page.getByRole("button", { name: "ثبت تکمیل" }).click();
        await expect.poll(async () => getWorkOrderStatus(database, workOrder.id)).toBe("completed");
        await page.getByRole("button", { name: "تأیید و بستن" }).click();
        await expect.poll(async () => getWorkOrderStatus(database, workOrder.id)).toBe("closed");
        await expect.poll(async () => getDefectStatus(database, defect.id)).toBe("closed");
      } finally {
        await operationalContext.close();
      }
    } finally {
      if (organizationId) {
        await database.query("UPDATE organizations SET status = 'archived', archived_at = now(), updated_at = now() WHERE id = $1", [organizationId]).catch(() => undefined);
        await database.query("UPDATE users SET status = 'suspended', updated_at = now() WHERE phone_number = $1", [managerPhone]).catch(() => undefined);
        await database.query("DELETE FROM user_sessions WHERE user_id = (SELECT id FROM users WHERE phone_number = $1)", [managerPhone]).catch(() => undefined);
      }
      await platformContext.close();
      await database.end();
    }
  });
});

async function signIn(page: import("@playwright/test").Page, path: string, email: string, password: string) {
  await page.goto(path);
  await page.getByLabel("ایمیل").fill(email);
  await page.getByLabel("رمز عبور").fill(password);
  await page.getByRole("button", { name: "ورود امن" }).click();
}

async function waitForRow<T extends QueryResultRow>(database: Pool, query: string, values: unknown[]): Promise<T> {
  let last: T | undefined;
  await expect.poll(async () => {
    const result = await database.query<T>(query, values);
    last = result.rows[0];
    return Boolean(last);
  }, { timeout: 30_000 }).toBe(true);
  return last!;
}

async function getWorkOrderStatus(database: Pool, id: string): Promise<string | undefined> {
  const result = await database.query<{ status: string }>("SELECT status FROM work_orders WHERE id = $1", [id]);
  return result.rows[0]?.status;
}

async function getDefectStatus(database: Pool, id: string): Promise<string | undefined> {
  const result = await database.query<{ status: string }>("SELECT status FROM defects WHERE id = $1", [id]);
  return result.rows[0]?.status;
}
