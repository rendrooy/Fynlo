import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

interface SheetProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

/** Bottom sheet di HP dan dialog di tengah layar pada desktop. */
export function Sheet({ open, title, onClose, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby="sheet-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      className="mx-0 mt-auto mb-0 max-h-[92dvh] w-full max-w-none rounded-t-3xl bg-surface text-ink lg:m-auto lg:max-w-md lg:rounded-3xl"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-4 py-2">
        <h2 id="sheet-title" className="text-base font-semibold">
          {title}
        </h2>
        <button
          type="button"
          aria-label="Tutup"
          onClick={onClose}
          className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface-muted"
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
    </dialog>
  )
}
