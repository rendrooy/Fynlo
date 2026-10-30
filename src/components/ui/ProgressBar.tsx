export type ProgressTone = 'normal' | 'warning' | 'over'

const fills: Record<ProgressTone, string> = {
  normal: 'bg-accent',
  warning: 'bg-warning',
  over: 'bg-expense',
}

export function ProgressBar({ value, tone = 'normal', label }: { value: number; tone?: ProgressTone; label: string }) {
  const percent = Math.round(value * 100)
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.min(percent, 100)}
      className="h-2 overflow-hidden rounded-full bg-surface-muted"
    >
      <div className={`h-full rounded-full ${fills[tone]}`} style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
  )
}
