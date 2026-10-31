"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { UiIcon, type UiIconName } from "@/components/ui-icon";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "medium",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: "medium" | "large";
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={`app-dialog app-dialog-${size}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="app-dialog-card" dir="rtl">
        <header className="app-dialog-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          <IconButton icon="close" label="بستن پنجره" onClick={onClose} />
        </header>
        <div className="app-dialog-body">{children}</div>
      </div>
    </dialog>
  );
}

export function IconButton({
  icon,
  label,
  onClick,
  type = "button",
  variant,
}: {
  icon: UiIconName;
  label: string;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "danger" | "quiet";
}) {
  return (
    <button
      className={`icon-button${variant ? ` icon-button-${variant}` : ""}`}
      type={type}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <UiIcon name={icon} />
    </button>
  );
}
