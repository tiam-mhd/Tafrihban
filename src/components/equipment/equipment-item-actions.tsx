"use client";

import { useState } from "react";
import { archiveEquipmentAction, restoreEquipmentAction, updateEquipmentAction } from "@/app/app/actions";
import { IconButton, Modal } from "@/components/ui/modal";
import { UiIcon } from "@/components/ui-icon";

export type EquipmentRecord = {
  id: string;
  organization_id: string;
  branch_id: string;
  category_id: string | null;
  category_name: string | null;
  category_status: string | null;
  asset_code: string;
  name: string;
  public_qr_id: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  location: string | null;
  status: string;
  created_by_name: string | null;
  created_at: Date;
  updated_at: Date;
  inspection_count: number;
  defect_count: number;
  work_order_count: number;
  schedule_count: number;
};

export type EquipmentEditableRecord = Pick<EquipmentRecord,
  "id" | "category_id" | "asset_code" | "name" | "manufacturer" | "model" | "serial_number" | "location" | "status"
>;

type CategoryOption = { id: string; name: string; status: string };

export function EquipmentItemActions({
  item,
  categories,
  organizationId,
  branchId,
}: {
  item: EquipmentRecord;
  categories: CategoryOption[];
  organizationId: string;
  branchId: string;
}) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const scopeFields = <><input type="hidden" name="organizationId" value={organizationId} /><input type="hidden" name="branchId" value={branchId} /><input type="hidden" name="equipmentId" value={item.id} /></>;

  return (
    <div className="asset-row-actions">
      {item.status !== "archived" ? <>
        <EquipmentEditDialog item={item} categories={categories} organizationId={organizationId} branchId={branchId} />
        <IconButton icon="archive" label={`بایگانی نرم ${item.name}`} variant="danger" onClick={() => setArchiveOpen(true)} />
      </> : <IconButton icon="restore" label={`بازیابی ${item.name}`} variant="quiet" onClick={() => setRestoreOpen(true)} />}

      <Modal open={archiveOpen} onClose={() => setArchiveOpen(false)} title="بایگانی پروندهٔ تجهیز" description="پرونده حذف فیزیکی نمی‌شود؛ سوابق و ارتباط‌های آن برای پیگیری‌های بعدی باقی می‌مانند.">
        <div className="dependency-summary">
          <p>این پرونده به موارد زیر وابسته است:</p>
          <ul>
            <li><strong>{item.inspection_count}</strong> بازرسی</li>
            <li><strong>{item.defect_count}</strong> عیب</li>
            <li><strong>{item.work_order_count}</strong> کار تعمیراتی</li>
            <li><strong>{item.schedule_count}</strong> برنامهٔ بازرسی</li>
          </ul>
          <p className="form-note">هیچ‌کدام پاک نمی‌شوند. تجهیز از فهرست روزمره و انتخاب برنامه‌های تازه خارج می‌شود.</p>
        </div>
        <form action={archiveEquipmentAction} className="form-stack">
          {scopeFields}
          <label className="field-label">یادداشت بایگانی (اختیاری)<textarea name="note" rows={3} maxLength={500} placeholder="علت بایگانی پرونده" /></label>
          <div className="modal-form-footer"><button className="button button-quiet" type="button" onClick={() => setArchiveOpen(false)}>انصراف</button><button className="button button-danger" type="submit">بایگانی نرم</button></div>
        </form>
      </Modal>

      <Modal open={restoreOpen} onClose={() => setRestoreOpen(false)} title="بازیابی پرونده" description="پرونده دوباره در فهرست تجهیزات فعال نمایش داده می‌شود. سوابق قبلی حفظ می‌شوند.">
        <form action={restoreEquipmentAction} className="form-stack">
          {scopeFields}
          <div className="modal-form-footer"><button className="button button-quiet" type="button" onClick={() => setRestoreOpen(false)}>انصراف</button><button className="button button-primary" type="submit"><UiIcon name="restore" /> بازیابی تجهیز</button></div>
        </form>
      </Modal>
    </div>
  );
}

export function EquipmentEditDialog({
  item,
  categories,
  organizationId,
  branchId,
  prominent = false,
}: {
  item: EquipmentEditableRecord;
  categories: CategoryOption[];
  organizationId: string;
  branchId: string;
  prominent?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const visibleCategories = categories.filter((category) => category.status === "active" || category.id === item.category_id);

  return <>
    {prominent
      ? <button className="button button-secondary" type="button" onClick={() => setOpen(true)}><UiIcon name="edit" /> ویرایش پرونده</button>
      : <IconButton icon="edit" label={`ویرایش ${item.name}`} onClick={() => setOpen(true)} />}
    <Modal open={open} onClose={() => setOpen(false)} title="ویرایش مشخصات تجهیز" description="کد دارایی و شناسهٔ QR پس از ساخت تغییر نمی‌کنند." size="large">
      <form action={updateEquipmentAction} className="form-stack">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="branchId" value={branchId} />
        <input type="hidden" name="equipmentId" value={item.id} />
        <div className="form-grid">
          <label className="field-label">نام تجهیز<input name="name" required minLength={2} maxLength={120} defaultValue={item.name} /></label>
          <label className="field-label">کد دارایی<input value={item.asset_code} readOnly dir="ltr" /></label>
          <label className="field-label">دسته‌بندی<select name="categoryId" defaultValue={item.category_id || ""}><option value="">بدون دسته‌بندی</option>{visibleCategories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.status !== "active" ? " · بایگانی‌شده" : ""}</option>)}</select></label>
          <label className="field-label">وضعیت<select name="status" defaultValue={item.status}><option value="active">فعال</option><option value="inactive">غیرفعال</option><option value="maintenance">در تعمیر</option></select></label>
          <label className="field-label">سازنده<input name="manufacturer" maxLength={100} defaultValue={item.manufacturer || ""} /></label>
          <label className="field-label">مدل<input name="model" maxLength={100} defaultValue={item.model || ""} /></label>
          <label className="field-label">شمارهٔ سریال<input name="serialNumber" maxLength={100} defaultValue={item.serial_number || ""} dir="ltr" /></label>
          <label className="field-label">موقعیت در شعبه<input name="location" maxLength={200} defaultValue={item.location || ""} /></label>
        </div>
        <div className="modal-form-footer"><span>آخرین ویرایش در سوابق تجهیز ثبت می‌شود.</span><button className="button button-primary" type="submit">ذخیرهٔ تغییرات</button></div>
      </form>
    </Modal>
  </>;
}
