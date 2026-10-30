import { Car, Film, House, Laptop, Receipt, ShoppingBag, Tag, Utensils, Wallet, type LucideIcon } from 'lucide-react'

const icons: Record<string, LucideIcon> = {
  wallet: Wallet,
  laptop: Laptop,
  utensils: Utensils,
  car: Car,
  home: House,
  receipt: Receipt,
  bag: ShoppingBag,
  film: Film,
}

export function CategoryIcon({ icon, className = 'size-5' }: { icon: string; className?: string }) {
  const Icon = icons[icon] ?? Tag
  return <Icon aria-hidden="true" className={className} />
}
