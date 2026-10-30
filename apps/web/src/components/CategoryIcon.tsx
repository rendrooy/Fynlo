"use client";

import {
  ArrowLeftRight,
  Car,
  Film,
  House,
  Laptop,
  type LucideIcon,
  Receipt,
  ShoppingBag,
  Tag,
  Utensils,
  Wallet,
} from "lucide-react";

const icons: Record<string, LucideIcon> = {
  bag: ShoppingBag,
  car: Car,
  film: Film,
  home: House,
  laptop: Laptop,
  receipt: Receipt,
  utensils: Utensils,
  wallet: Wallet,
};

export const categoryIconNames = Object.keys(icons);

export function CategoryIcon({
  className = "size-5",
  icon,
}: {
  className?: string;
  icon: string;
}) {
  const Icon = icons[icon] ?? Tag;
  return <Icon aria-hidden="true" className={className} />;
}

export function TransactionIcon({ icon }: { icon?: string }) {
  return icon === "transfer" ? (
    <div className="tx-icon cat-swap">
      <ArrowLeftRight aria-hidden="true" className="size-5" />
    </div>
  ) : (
    <div className={`tx-icon cat-${icon}`}>
      <CategoryIcon icon={icon ?? ""} />
    </div>
  );
}
