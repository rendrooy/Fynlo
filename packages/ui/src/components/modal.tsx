"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";

interface DialogProps {
  children: ReactNode;
  className: string;
  onClose: () => void;
  open: boolean;
}

/** Native dialog, so focus trapping and Escape work without extra code. */
export function Dialog({ children, className, onClose, open }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      className={className}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      onClose={onClose}
      ref={ref}
    >
      {children}
    </dialog>
  );
}

export function Modal({
  children,
  onClose,
  open,
  title,
}: Omit<DialogProps, "className"> & { title: string }) {
  return (
    <Dialog className="modal" onClose={onClose} open={open}>
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          aria-label="Close"
          className="icon-btn"
          onClick={onClose}
          type="button"
        >
          <X aria-hidden="true" size={20} />
        </button>
      </div>
      {children}
    </Dialog>
  );
}
