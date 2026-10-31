"use client";

import { useState } from "react";
import Link from "next/link";
import { archiveEquipmentCategoryAction, createCategoryAction, restoreEquipmentCategoryAction, updateCategoryAction } from "@/app/app/actions";
import { IconButton, Modal } from "@/components/ui/modal";
import { UiIcon } from "@/components/ui-icon";

export type EquipmentCategoryRecord = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  equipment_count: number;
  created_at: Date;
};

export type CategoryFilters = { q: string; status: string; usage: string; createdFrom: string; createdTo: string };

export function CategoryManagement({
  organizationId,
  branchId,
  categories,
  filters,
}: {
  organizationId: string;
  branchId: string;
  categories: EquipmentCategoryRecord[];
  filters: CategoryFilters;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const scopeParams = `organizationId=${encodeURIComponent(organizationId)}&branchId=${encodeURIComponent(branchId)}`;
  const clearUrl = `/app/equipment/categories?${scopeParams}`;
  const activeFilters = Number(filters.status !== "active") + Number(Boolean(filters.usage)) + Number(Boolean(filters.createdFrom)) + Number(Boolean(filters.createdTo));
  const hasActiveFilters = Boolean(filters.q || filters.status !== "active" || filters.usage || filters.createdFrom || filters.createdTo);

  return <>
    <div className="equipment-toolbar category-toolbar">
      <form action="/app/equipment/categories" method="get" className="equipment-search" role="search">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="branchId" value={branchId} />
        <input type="hidden" name="status" value={filters.status} />
        {filters.usage && <input type="hidden" name="usage" value={filters.usage} />}
        {filters.createdFrom && <input type="hidden" name="createdFrom" value={filters.createdFrom} />}
        {filters.createdTo && <input type="hidden" name="createdTo" value={filters.createdTo} />}
        <label className="equipment-search-input"><UiIcon name="search" /><span className="sr-only">جستجوی دسته‌بندی‌ها</span><input type="search" name="q" maxLength={100} placeholder="جستجو در نام و توضیح دسته‌بندی" defaultValue={filters.q} /></label>
        <button className="button button-secondary" type="submit">جستجو</button>
      </form>
      <div className="equipment-toolbar-actions">
        <button className="button button-secondary" type="button" onClick={() => setFilterOpen(true)}><UiIcon name="filter" /> فیلتر {activeFilters > 0 && <span className="filter-count">{activeFilters}</span>}</button>
        <button className="button button-primary" type="button" onClick={() => setCreateOpen(true)}><UiIcon name="plus" /> دسته‌بندی تازه</button>
      </div>
    </div>

    <section className="category-results">
      <div className="results-summary"><div><span className="eyebrow">ساختار پرونده‌ها</span><strong>{categories.length} دسته‌بندی</strong></div><span>دسته‌بندی مشترک در همهٔ شعب این مجموعه</span></div>
      {!categories.length ? <div className="panel category-empty"><div className="category-empty-icon"><UiIcon name="category" size={24} /></div><h2>{hasActiveFilters ? "دسته‌بندی‌ای با این شرایط پیدا نشد" : "هنوز دسته‌بندی‌ای نساخته‌اید"}</h2><p>{hasActiveFilters ? "فیلترها را پاک کنید یا عبارت دیگری را جستجو کنید." : "دسته‌بندی‌ها کمک می‌کنند تجهیزات مجموعه را منظم‌تر پیدا و مدیریت کنید."}</p>{hasActiveFilters ? <Link className="button button-secondary" href={clearUrl}>پاک‌کردن فیلترها</Link> : <button className="button button-primary" type="button" onClick={() => setCreateOpen(true)}><UiIcon name="plus" /> ساخت اولین دسته‌بندی</button>}</div>
        : <div className="category-card-grid">{categories.map((category) => <CategoryCard key={category.id} category={category} organizationId={organizationId} branchId={branchId} />)}</div>}
    </section>

    <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="ساخت دسته‌بندی" description="دسته‌بندی‌های این مجموعه برای همهٔ شعب در دسترس هستند.">
      <form action={createCategoryAction} className="form-stack">
        <input type="hidden" name="organizationId" value={organizationId} /><input type="hidden" name="branchId" value={branchId} />
        <label className="field-label">نام دسته‌بندی<input name="name" required minLength={2} maxLength={80} /></label>
        <label className="field-label">توضیح<textarea name="description" maxLength={300} rows={4} placeholder="کاربرد یا نوع تجهیزات این دسته" /></label>
        <div className="modal-form-footer"><span>نام دسته‌بندی در این مجموعه یکتا است.</span><button className="button button-primary" type="submit">ثبت دسته‌بندی</button></div>
      </form>
    </Modal>

    <Modal open={filterOpen} onClose={() => setFilterOpen(false)} title="فیلتر دسته‌بندی‌ها" description="فهرست را بر اساس وضعیت، استفاده و زمان ساخت محدود کنید.">
      <form action="/app/equipment/categories" method="get" className="form-stack">
        <input type="hidden" name="organizationId" value={organizationId} /><input type="hidden" name="branchId" value={branchId} />
        {filters.q && <input type="hidden" name="q" value={filters.q} />}
        <div className="form-grid">
          <label className="field-label">وضعیت<select name="status" defaultValue={filters.status}><option value="active">فعال</option><option value="archived">بایگانی‌شده</option><option value="all">همه</option></select></label>
          <label className="field-label">ارتباط با تجهیزات<select name="usage" defaultValue={filters.usage}><option value="">همه</option><option value="used">دارای تجهیز</option><option value="unused">بدون تجهیز</option></select></label>
          <label className="field-label">ساخته‌شده از<input type="date" name="createdFrom" defaultValue={filters.createdFrom} /></label>
          <label className="field-label">ساخته‌شده تا<input type="date" name="createdTo" defaultValue={filters.createdTo} /></label>
        </div>
        <div className="modal-form-footer"><Link className="text-link" href={clearUrl}>بازنشانی فیلترها</Link><button className="button button-primary" type="submit">اعمال فیلتر</button></div>
      </form>
    </Modal>
  </>;
}

function CategoryCard({ category, organizationId, branchId }: { category: EquipmentCategoryRecord; organizationId: string; branchId: string }) {
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const scopeFields = <><input type="hidden" name="organizationId" value={organizationId} /><input type="hidden" name="branchId" value={branchId} /><input type="hidden" name="categoryId" value={category.id} /></>;

  return <article className={`category-card${category.status === "archived" ? " category-card-archived" : ""}`}>
    <div className="category-card-top"><span className="category-card-icon"><UiIcon name="category" /></span><span className={`pill ${category.status === "archived" ? "pill-muted" : "pill-teal"}`}>{category.status === "archived" ? "بایگانی‌شده" : "فعال"}</span></div>
    <div className="category-card-copy"><h2>{category.name}</h2><p>{category.description || "بدون توضیح"}</p></div>
    <div className="category-card-meta"><strong>{category.equipment_count.toLocaleString("fa-IR")}</strong><span>پروندهٔ تجهیز مرتبط</span></div>
    <div className="category-card-actions">
      <IconButton icon="edit" label={`ویرایش دسته‌بندی ${category.name}`} onClick={() => setEditOpen(true)} />
      {category.status === "active" ? <IconButton icon="archive" label={`بایگانی دسته‌بندی ${category.name}`} variant="danger" onClick={() => setArchiveOpen(true)} /> : <IconButton icon="restore" label={`بازیابی دسته‌بندی ${category.name}`} variant="quiet" onClick={() => setRestoreOpen(true)} />}
    </div>

    <Modal open={editOpen} onClose={() => setEditOpen(false)} title="ویرایش دسته‌بندی" description="تغییر نام و توضیح روی همهٔ پرونده‌های مرتبط نمایش داده می‌شود.">
      <form action={updateCategoryAction} className="form-stack">
        {scopeFields}
        <label className="field-label">نام دسته‌بندی<input name="name" required minLength={2} maxLength={80} defaultValue={category.name} /></label>
        <label className="field-label">توضیح<textarea name="description" maxLength={300} rows={4} defaultValue={category.description || ""} /></label>
        <div className="modal-form-footer"><span>{category.equipment_count.toLocaleString("fa-IR")} پرونده به این دسته مرتبط است.</span><button className="button button-primary" type="submit">ذخیرهٔ تغییرات</button></div>
      </form>
    </Modal>

    <Modal open={archiveOpen} onClose={() => setArchiveOpen(false)} title="بایگانی دسته‌بندی" description="دسته‌بندی از گزینه‌های انتخاب تجهیزات جدید حذف می‌شود؛ پرونده‌های فعلی و تاریخچهٔ آن‌ها حفظ می‌شوند.">
      <div className="dependency-summary"><p>این دسته‌بندی به <strong>{category.equipment_count.toLocaleString("fa-IR")} پروندهٔ تجهیز</strong> متصل است.</p><p className="form-note">تجهیزهای موجود بدون دسته‌بندی مجدد باقی می‌مانند. هر زمان بخواهید می‌توانید دسته را بازیابی کنید.</p></div>
      <form action={archiveEquipmentCategoryAction} className="modal-form-footer">
        {scopeFields}
        <button className="button button-quiet" type="button" onClick={() => setArchiveOpen(false)}>انصراف</button><button className="button button-danger" type="submit">بایگانی دسته‌بندی</button>
      </form>
    </Modal>

    <Modal open={restoreOpen} onClose={() => setRestoreOpen(false)} title="بازیابی دسته‌بندی" description="این دسته دوباره در فهرست گزینه‌های پروندهٔ تجهیز قرار می‌گیرد.">
      <form action={restoreEquipmentCategoryAction} className="modal-form-footer">
        {scopeFields}
        <button className="button button-quiet" type="button" onClick={() => setRestoreOpen(false)}>انصراف</button><button className="button button-primary" type="submit"><UiIcon name="restore" /> بازیابی</button>
      </form>
    </Modal>
  </article>;
}
