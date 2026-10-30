"use client";

import {
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
