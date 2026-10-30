import { ChartColumn, House, ListOrdered, PiggyBank, Plus, Settings, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { TransactionForm } from './TransactionForm'
import { Button } from './ui/Button'
import { Sheet } from './ui/Sheet'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

const leftNav: NavItem[] = [
  { to: '/', label: 'Beranda', icon: House },
  { to: '/transaksi', label: 'Transaksi', icon: ListOrdered },
]
const rightNav: NavItem[] = [
  { to: '/anggaran', label: 'Anggaran', icon: PiggyBank },
  { to: '/laporan', label: 'Laporan', icon: ChartColumn },
]

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
      <img src="/favicon.svg" alt="" className="size-7" />
      Fynlo
    </Link>
  )
}

function BottomLink({ to, label, icon: Icon }: NavItem) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
          isActive ? 'text-accent' : 'text-muted'
        }`
      }
    >
      <Icon aria-hidden="true" className="size-5" />
      {label}
    </NavLink>
  )
}

function SideLink({ to, label, icon: Icon }: NavItem) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium ${
          isActive ? 'bg-accent-soft text-ink' : 'text-muted hover:bg-surface-muted hover:text-ink'
        }`
      }
    >
      <Icon aria-hidden="true" className="size-5" />
      {label}
    </NavLink>
  )
}

export function AppLayout() {
  const [adding, setAdding] = useState(false)
  const [toast, setToast] = useState(false)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(false), 2500)
    return () => clearTimeout(timer)
  }, [toast])

  return (
    <div className="min-h-dvh lg:pl-60">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col gap-6 border-r border-line bg-surface p-4 lg:flex">
        <Logo />
        <Button onClick={() => setAdding(true)}>
          <Plus aria-hidden="true" className="size-4" />
          Tambah transaksi
        </Button>
        <nav aria-label="Navigasi utama" className="flex flex-1 flex-col gap-1">
          {[...leftNav, ...rightNav].map((item) => (
            <SideLink key={item.to} {...item} />
          ))}
          <div className="mt-auto">
            <SideLink to="/pengaturan" label="Pengaturan" icon={Settings} />
          </div>
        </nav>
      </aside>

      <header className="flex items-center justify-between px-4 pt-3 lg:hidden">
        <Logo />
        <Link
          to="/pengaturan"
          aria-label="Pengaturan"
          className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface-muted"
        >
          <Settings aria-hidden="true" className="size-5" />
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-3 pb-28 lg:px-8 lg:pt-8 lg:pb-10">
        <Outlet />
      </main>

      <nav
        aria-label="Navigasi utama"
        className="fixed inset-x-0 bottom-0 z-20 flex items-center border-t border-line bg-surface px-1 pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {leftNav.map((item) => (
          <BottomLink key={item.to} {...item} />
        ))}
        <div className="flex flex-1 justify-center">
          <button
            type="button"
            aria-label="Tambah transaksi"
            onClick={() => setAdding(true)}
            className="flex size-12 items-center justify-center rounded-2xl bg-accent text-on-accent shadow-md"
          >
            <Plus aria-hidden="true" className="size-6" />
          </button>
        </div>
        {rightNav.map((item) => (
          <BottomLink key={item.to} {...item} />
        ))}
      </nav>

      <Sheet open={adding} title="Tambah transaksi" onClose={() => setAdding(false)}>
        {adding && (
          <TransactionForm
            onSaved={() => {
              setAdding(false)
              setToast(true)
            }}
          />
        )}
      </Sheet>

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center px-4 lg:bottom-6">
        {toast && (
          <p className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-bg shadow-lg">Transaksi tersimpan</p>
        )}
      </div>
    </div>
  )
}
