import type { ReactNode } from 'react'

export const fieldClass =
  'min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-base text-ink placeholder:text-muted lg:text-sm'

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {error && <span className="mt-1.5 block text-sm text-expense">{error}</span>}
    </label>
  )
}
