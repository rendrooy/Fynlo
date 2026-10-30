import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost'
}

const variants = {
  primary: 'bg-accent text-on-accent hover:opacity-90',
  ghost: 'text-ink hover:bg-surface-muted',
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:opacity-40 ${variants[variant]} ${className}`}
      {...props}
    />
  )
}
