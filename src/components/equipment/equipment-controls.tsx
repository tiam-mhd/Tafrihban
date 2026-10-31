"use client";

import { useState } from "react";
import Link from "next/link";
import { createEquipmentAction } from "@/app/app/actions";
import { Modal } from "@/components/ui/modal";
import { UiIcon } from "@/components/ui-icon";

type CategoryOption = { id: string; name: string; status: string };
export type EquipmentFilters = {
  q: string;
  assetCode: string;
  name: string;
  categoryId: string;
  status: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  location: string;
  createdBy: string;
  createdFrom: string;
  createdTo: string;
  updatedFrom: string;
  updatedTo: string;
  includeArchived: boolean;
};

const retainedFilters = [
  "assetCode", "name", "categoryId", "status", "manufacturer", "model", "serialNumber", "location",
  "createdBy", "createdFrom", "createdTo", "updatedFrom", "updatedTo",
] as const;

export function EquipmentControls({
  organizationId,
  branchId,
  canManage,
  categories,
  creators,
  filters,
}: {
  organizationId: string;
  branchId: string;
  canManage: boolean;
  categories: CategoryOption[];
  creators: { id: string; name: string }[];
  filters: EquipmentFilters;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterCount = retainedFilters.filter((key) => filters[key] !== "").length + Number(filters.includeArchived);
  const scopeParams = `organizationId=${encodeURIComponent(organizationId)}&branchId=${encodeURIComponent(branchId)}`;
  const clearUrl = `/app/equipment?${scopeParams}`;

  return (
    <div className="equipment-toolbar">
      <form action="/app/equipment" method="get" className="equipment-search" role="search">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="branchId" value={branchId} />
        {retainedFilters.map((key) => filters[key] && <input key={key} type="hidden" name={key} value={filters[key]} />)}
        {filters.includeArchived && <input type="hidden" name="includeArchived" value="1" />}
        <label className="equipment-search-input">
          <UiIcon name="search" />
          <span className="sr-only">جستجوی تجهیزات</span>
          <input name="q" type="search" maxLength={120} placeholder="جستجو در نام، کد، سازنده، مدل، سریال…" defaultValue={filters.q} />
        </label>
        <button className="button button-secondary" type="submit">جستجو</button>
      </form>

      <div className="equipment-toolbar-actions">
        <button className="button button-secondary equipment-filter-trigger" type="button" onClick={() => setFilterOpen(true)}>
          <UiIcon name="filter" /> فیلتر {filterCount > 0 && <span className="filter-count">{filterCount}</span>}
        </button>
        <Link className="button button-secondary" href={`/app/scan?${scopeParams}`}><UiIcon name="scan" /> اسکن QR</Link>
        {canManage && <button className="button button-primary" type="button" onClick={() => setCreateOpen(true)}><UiIcon name="plus" /> افزودن تجهیز</button>}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="ثبت پروندهٔ تجهیز" description="شناسهٔ QR به‌صورت تصادفی ساخته می‌شود و کد دارایی در این مجموعه یکتا است." size="large">
        <form action={createEquipmentAction} className="form-stack">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="branchId" value={branchId} />
          <div className="form-grid">
            <label className="field-label">نام تجهیز<input name="name" required minLength={2} maxLength={120} /></label>
            <label className="field-label">کد دارایی<input name="assetCode" required maxLength={40} dir="ltr" /></label>
            <label className="field-label">دسته‌بندی<select name="categoryId" defaultValue=""><option value="">بدون دسته‌بندی</option>{categories.filter((category) => category.status === "active").map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label className="field-label">سازنده<input name="manufacturer" maxLength={100} /></label>
            <label className="field-label">مدل<input name="model" maxLength={100} /></label>
            <label className="field-label">شمارهٔ سریال<input name="serialNumber" maxLength={100} dir="ltr" /></label>
            <label className="field-label span-all">موقعیت در شعبه<input name="location" maxLength={200} /></label>
          </div>
          <div className="modal-form-footer"><span>پس از ثبت، پرونده و QR یکتا ساخته می‌شود.</span><button className="button button-primary" type="submit">ساخت پرونده</button></div>
        </form>
      </Modal>

      <Modal open={filterOpen} onClose={() => setFilterOpen(false)} title="فیلتر پیشرفتهٔ تجهیزات" description="فیلترها روی اطلاعات همین شعبه اعمال می‌شوند و می‌توانید چند شرط را هم‌زمان ترکیب کنید." size="large">
        <form action="/app/equipment" method="get" className="form-stack">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="branchId" value={branchId} />
          {filters.q && <input type="hidden" name="q" value={filters.q} />}
          <div className="form-grid equipment-filter-grid">
            <label className="field-label">کد دارایی<input name="assetCode" maxLength={40} defaultValue={filters.assetCode} /></label>
            <label className="field-label">نام تجهیز<input name="name" maxLength={120} defaultValue={filters.name} /></label>
            <label className="field-label">دسته‌بندی<select name="categoryId" defaultValue={filters.categoryId}><option value="">همهٔ دسته‌بندی‌ها</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.status !== "active" ? " · بایگانی‌شده" : ""}</option>)}</select></label>
            <label className="field-label">وضعیت<select name="status" defaultValue={filters.status}><option value="">همهٔ وضعیت‌ها</option><option value="active">فعال</option><option value="inactive">غیرفعال</option><option value="maintenance">در تعمیر</option><option value="archived">بایگانی‌شده</option></select></label>
            <label className="field-label">سازنده<input name="manufacturer" maxLength={100} defaultValue={filters.manufacturer} /></label>
            <label className="field-label">مدل<input name="model" maxLength={100} defaultValue={filters.model} /></label>
            <label className="field-label">شمارهٔ سریال<input name="serialNumber" maxLength={100} defaultValue={filters.serialNumber} dir="ltr" /></label>
            <label className="field-label">موقعیت<input name="location" maxLength={200} defaultValue={filters.location} /></label>
            <label className="field-label">ثبت‌کنندهٔ پرونده<select name="createdBy" defaultValue={filters.createdBy}><option value="">همهٔ ثبت‌کنندگان</option>{creators.map((creator) => <option key={creator.id} value={creator.id}>{creator.name}</option>)}</select></label>
            <label className="field-label">ثبت از تاریخ<input type="date" name="createdFrom" defaultValue={filters.createdFrom} /></label>
            <label className="field-label">ثبت تا تاریخ<input type="date" name="createdTo" defaultValue={filters.createdTo} /></label>
            <label className="field-label">آخرین ویرایش از<input type="date" name="updatedFrom" defaultValue={filters.updatedFrom} /></label>
            <label className="field-label">آخرین ویرایش تا<input type="date" name="updatedTo" defaultValue={filters.updatedTo} /></label>
          </div>
          <label className="check-field"><input type="checkbox" name="includeArchived" value="1" defaultChecked={filters.includeArchived} /> نمایش پرونده‌های بایگانی‌شده</label>
          <div className="modal-form-footer"><Link className="text-link" href={clearUrl}>پاک‌کردن همهٔ فیلترها</Link><button className="button button-primary" type="submit">اعمال فیلترها</button></div>
        </form>
      </Modal>
    </div>
  );
}
