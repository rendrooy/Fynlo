"use client";

import { Badge } from "@fynlo/ui/components/badge";
import { Button } from "@fynlo/ui/components/button";
import {
  Bell,
  Calendar,
  ChevronRight,
  Download,
  Link2,
  ListFilter,
  type LucideIcon,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  Trash2,
  Wallet,
} from "lucide-react";
import { useTheme } from "next-themes";

import { currentUser, NOT_AVAILABLE } from "@/constants";
import { useFinance } from "@/providers/finance-provider";
import { useTransactionSheet } from "@/providers/transaction-sheet-provider";

interface SettingsItem {
  action?: () => void;
  badge?: string;
  danger?: boolean;
  description: string;
  icon: LucideIcon;
  title: string;
  value?: string;
}

export default function PageContent() {
  const { accounts, categories } = useFinance();
  const { toast } = useTransactionSheet();
  const { setTheme, theme } = useTheme();
  const dark = theme === "dark";

  const groups: { items: SettingsItem[]; title: string }[] = [
    {
      items: [
        {
          description: `${currentUser.name} · ${currentUser.email}`,
          icon: Settings,
          title: "Personal profile",
          value: "IDR",
        },
        {
          description: "Manage aliases, masks, and tracking sources",
          icon: Wallet,
          title: "Tracked accounts",
          value: `${accounts.length} accounts`,
        },
        {
          description: "Set names, icons, and categorization rules",
          icon: ListFilter,
          title: "Transaction categories",
          value: `${categories.length} categories`,
        },
      ],
      title: "Account",
    },
    {
      items: [
        {
          action: () => {
            setTheme(dark ? "light" : "dark");
            toast(`${dark ? "Light" : "Dark"} theme turned on`);
          },
          description: "Choose the app theme",
          icon: dark ? Moon : Sun,
          title: "Appearance",
          value: dark ? "Dark" : "Light",
        },
        {
          description: "Indonesian rupiah · Asia/Jakarta",
          icon: Calendar,
          title: "Region & time",
          value: "WIB",
        },
        {
          description: "Send transactions from your iPhone",
          icon: Link2,
          title: "iOS Shortcuts automation",
        },
        {
          description: "Set review reminders and transaction updates",
          icon: Bell,
          title: "Notifications",
        },
      ],
      title: "Preferences",
    },
    {
      items: [
        {
          description: "Device tokens and access",
          icon: ShieldCheck,
          title: "Privacy & security",
        },
        {
          description: "Download all of your financial data",
          icon: Download,
          title: "Export data",
        },
        {
          danger: true,
          description: "Permanently delete all of your data",
          icon: Trash2,
          title: "Delete data & account",
        },
      ],
      title: "Data & security",
    },
  ];

  return (
    <div className="page settings-page">
      <div className="page-intro">
        <div>
          <h1>Settings</h1>
          <p>Manage your preferences, automation, and account security.</p>
        </div>
      </div>

      <div className="settings-profile card">
        <div className="avatar large">{currentUser.initials}</div>
        <div>
          <b>{currentUser.name}</b>
          <span>{currentUser.email}</span>
        </div>
        <Button kind="secondary" onClick={() => toast(NOT_AVAILABLE)}>
          Manage Profile
        </Button>
      </div>

      <div className="settings-groups">
        {groups.map((group) => (
          <section className="settings-group" key={group.title}>
            <h2>{group.title}</h2>
            <div className="card settings-list">
              {group.items.map((item) => (
                <button
                  className={`settings-row ${item.danger ? "danger" : ""}`}
                  key={item.title}
                  onClick={item.action ?? (() => toast(NOT_AVAILABLE))}
                  type="button"
                >
                  <div className="settings-row-icon">
                    <item.icon aria-hidden="true" size={20} />
                  </div>
                  <div className="settings-row-copy">
                    <b>{item.title}</b>
                    <span>{item.description}</span>
                  </div>
                  {item.badge && <Badge tone="success">{item.badge}</Badge>}
                  {item.value && (
                    <span className="settings-value">{item.value}</span>
                  )}
                  <ChevronRight aria-hidden="true" className="icon" size={17} />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="settings-version">
        <div className="brandmark">F</div>
        <div>
          <b>Fynlo</b>
          <span>Prototype version 0.1</span>
        </div>
      </div>
    </div>
  );
}
