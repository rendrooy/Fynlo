"use client";

import { Button } from "@fynlo/ui/components/button";
import { Modal } from "@fynlo/ui/components/modal";
import {
  ArrowLeftRight,
  Bell,
  Calendar,
  ChartColumn,
  ChevronRight,
  CircleCheck,
  Ellipsis,
  LayoutGrid,
  type LucideIcon,
  Moon,
  Plus,
  Settings,
  Sun,
  Target,
  Wallet,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import { useMounted } from "@/hooks";
import { useAuth } from "@/providers/auth-provider";
import { useFinance } from "@/providers/finance-provider";
import { useTransactionSheet } from "@/providers/transaction-sheet-provider";
import { formatMonth } from "@/utils/format";

interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
}

const nav: NavItem[] = [
  { href: "/dashboard", icon: LayoutGrid, label: "Dashboard" },
  { href: "/transactions", icon: ArrowLeftRight, label: "Transactions" },
  { href: "/accounts", icon: Wallet, label: "Accounts" },
  { href: "/analytics", icon: ChartColumn, label: "Analytics" },
  { href: "/budgets", icon: Target, label: "Budgets" },
  { href: "/weekly-review", icon: CircleCheck, label: "Weekly Review" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

const mobileNav = nav.slice(0, 4);
const moreNav = nav.slice(4);

export default function LayoutClient({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { refresh, status } = useAuth();

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
  }, [router, status]);

  if (status === "unavailable") {
    return (
      <main className="auth-page">
        <div className="auth-card card">
          <h1>Can&apos;t reach the server</h1>
          <p>You are still signed in. Check your connection and try again.</p>
          <Button onClick={() => void refresh()}>Try again</Button>
        </div>
      </main>
    );
  }
  // Nothing private renders until the session is confirmed.
  if (status !== "authenticated") {
    return (
      <main className="auth-page">
        <p className="auth-loading">Loading...</p>
      </main>
    );
  }
  return <AppShell>{children}</AppShell>;
}

function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const mounted = useMounted();
  const pathname = usePathname();
  const { openSheet, toast } = useTransactionSheet();
  const { setTheme, theme } = useTheme();
  const { loadTransactions, transactions, transactionsStatus } = useFinance();
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const current = nav.find((item) => pathname.startsWith(item.href));
  const pending = transactions.filter((t) => t.status === "review").length;
  const dark = theme === "dark";
  const showAdd =
    pathname.startsWith("/dashboard") || pathname.startsWith("/transactions");

  return (
    <div className="app">
      <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
        <div className="brand">
          <div className="brandmark">F</div>
          {!collapsed && (
            <div>
              <strong>fynlo</strong>
              <span>Personal finance tracker</span>
            </div>
          )}
        </div>
        <nav aria-label="Main navigation" className="nav-list">
          {nav.map((item) => (
            <Link
              aria-current={current?.href === item.href ? "page" : undefined}
              aria-label={collapsed ? item.label : undefined}
              className={`nav-item ${current?.href === item.href ? "active" : ""}`}
              href={item.href}
              key={item.href}
              title={item.label}
            >
              <item.icon aria-hidden="true" size={20} />
              {!collapsed && <span>{item.label}</span>}
              {mounted &&
                !collapsed &&
                item.href === "/weekly-review" &&
                pending > 0 && <i>{pending}</i>}
            </Link>
          ))}
        </nav>
        <button
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          type="button"
        >
          <ChevronRight aria-hidden="true" size={18} />
        </button>
      </aside>

      <div className="app-main">
        <header className="header">
          <div>
            <div className="eyebrow">Personal finance</div>
            <div className="page-title">{current?.label}</div>
          </div>
          <div className="header-actions">
            {mounted && (
              <span className="date-label date-btn">
                <Calendar aria-hidden="true" size={17} />
                {formatMonth(new Date())}
              </span>
            )}
            {showAdd && (
              <Button onClick={() => openSheet()}>
                <Plus aria-hidden="true" size={17} />
                Add Transaction
              </Button>
            )}
            <button
              aria-label={
                dark ? "Switch to light theme" : "Switch to dark theme"
              }
              className="icon-btn"
              onClick={() => setTheme(dark ? "light" : "dark")}
              type="button"
            >
              {mounted && dark ? (
                <Sun aria-hidden="true" size={19} />
              ) : (
                <Moon aria-hidden="true" size={19} />
              )}
            </button>
            <button
              aria-label="Notifications"
              className="icon-btn"
              onClick={() => toast("No new notifications")}
              type="button"
            >
              <Bell aria-hidden="true" size={19} />
            </button>
            <div className="avatar">{user?.initials}</div>
          </div>
        </header>
        {/* Pages depend on today's date, so they render only in the browser to avoid differing from the built HTML. */}
        <main>
          {transactionsStatus === "error" && (
            <div className="card load-error" role="alert">
              <div>
                <b>Couldn&apos;t load your transactions</b>
                <span>Balances and reports may be incomplete.</span>
              </div>
              <Button kind="secondary" onClick={() => void loadTransactions()}>
                Try again
              </Button>
            </div>
          )}
          {mounted ? children : <div className="page">Loading...</div>}
        </main>
      </div>

      <nav aria-label="Main navigation" className="mobile-nav">
        {mobileNav.map((item) => (
          <Link
            aria-current={current?.href === item.href ? "page" : undefined}
            className={current?.href === item.href ? "active" : undefined}
            href={item.href}
            key={item.href}
          >
            <item.icon aria-hidden="true" size={19} />
            <span>{item.label}</span>
          </Link>
        ))}
        <button
          className={
            moreNav.some((item) => item.href === current?.href)
              ? "active"
              : undefined
          }
          onClick={() => setMoreOpen(true)}
          type="button"
        >
          <Ellipsis aria-hidden="true" size={19} />
          <span>More</span>
        </button>
      </nav>

      <Modal onClose={() => setMoreOpen(false)} open={moreOpen} title="More">
        <div className="more-list">
          {moreNav.map((item) => (
            <Link
              className={`nav-item ${current?.href === item.href ? "active" : ""}`}
              href={item.href}
              key={item.href}
              onClick={() => setMoreOpen(false)}
            >
              <item.icon aria-hidden="true" size={20} />
              <span>{item.label}</span>
              {item.href === "/weekly-review" && pending > 0 && (
                <i>{pending}</i>
              )}
            </Link>
          ))}
        </div>
      </Modal>
    </div>
  );
}
