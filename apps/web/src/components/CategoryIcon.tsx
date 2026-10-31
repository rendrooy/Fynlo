"use client";

import type { CSSProperties } from "react";

import {
  Apple,
  ArrowLeftRight,
  Baby,
  Banknote,
  Beer,
  Bike,
  BookOpen,
  Briefcase,
  Building2,
  Bus,
  Camera,
  Car,
  Cat,
  Coffee,
  Coins,
  CreditCard,
  Dog,
  Droplet,
  Dumbbell,
  Film,
  Flame,
  Fuel,
  Gamepad2,
  Gem,
  Gift,
  GraduationCap,
  HandHeart,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  type LucideIcon,
  MapPin,
  Music,
  Palette,
  PiggyBank,
  Pill,
  Pizza,
  Plane,
  Receipt,
  Scissors,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sofa,
  Sparkles,
  SquareParking,
  Stethoscope,
  Tag,
  Tent,
  Ticket,
  TrainFront,
  TreePine,
  TrendingUp,
  Tv,
  Users,
  Utensils,
  Wallet,
  Wifi,
  Wrench,
  Zap,
} from "lucide-react";

const icons: Record<string, { Icon: LucideIcon; words: string }> = {
  apple: { Icon: Apple, words: "fruit buah groceries" },
  baby: { Icon: Baby, words: "child anak bayi" },
  bag: { Icon: ShoppingBag, words: "shopping belanja" },
  banknote: { Icon: Banknote, words: "cash tunai uang" },
  beer: { Icon: Beer, words: "drink minum" },
  bike: { Icon: Bike, words: "sepeda motor ojek" },
  book: { Icon: BookOpen, words: "buku belajar" },
  briefcase: { Icon: Briefcase, words: "work salary kerja gaji" },
  building: { Icon: Building2, words: "apartment apartemen kantor" },
  bus: { Icon: Bus, words: "transport angkot" },
  camera: { Icon: Camera, words: "foto hobby" },
  car: { Icon: Car, words: "transport mobil" },
  cart: { Icon: ShoppingCart, words: "groceries belanja supermarket" },
  cat: { Icon: Cat, words: "pet kucing peliharaan" },
  coffee: { Icon: Coffee, words: "kopi cafe" },
  coins: { Icon: Coins, words: "koin uang" },
  "credit-card": { Icon: CreditCard, words: "kartu kredit cicilan" },
  dog: { Icon: Dog, words: "pet anjing peliharaan" },
  droplet: { Icon: Droplet, words: "water air pdam" },
  dumbbell: { Icon: Dumbbell, words: "gym olahraga fitness" },
  film: { Icon: Film, words: "movie bioskop entertainment hiburan" },
  flame: { Icon: Flame, words: "gas api" },
  fuel: { Icon: Fuel, words: "gas bensin" },
  gamepad: { Icon: Gamepad2, words: "game" },
  gem: { Icon: Gem, words: "luxury perhiasan" },
  gift: { Icon: Gift, words: "hadiah present" },
  graduation: { Icon: GraduationCap, words: "education kuliah sekolah" },
  "hand-heart": { Icon: HandHeart, words: "charity donasi sedekah zakat" },
  "heart-pulse": { Icon: HeartPulse, words: "health kesehatan" },
  home: { Icon: House, words: "housing rumah kos sewa" },
  landmark: { Icon: Landmark, words: "bank pajak tax" },
  laptop: { Icon: Laptop, words: "work freelance kerja" },
  map: { Icon: MapPin, words: "travel lokasi" },
  music: { Icon: Music, words: "musik spotify" },
  palette: { Icon: Palette, words: "art hobby seni" },
  parking: { Icon: SquareParking, words: "parkir" },
  phone: { Icon: Smartphone, words: "pulsa hp" },
  "piggy-bank": { Icon: PiggyBank, words: "savings tabungan" },
  pill: { Icon: Pill, words: "medicine obat apotek" },
  pizza: { Icon: Pizza, words: "food makan jajan" },
  plane: { Icon: Plane, words: "travel pesawat liburan" },
  receipt: { Icon: Receipt, words: "bills tagihan" },
  scissors: { Icon: Scissors, words: "haircut salon potong rambut" },
  shield: { Icon: ShieldCheck, words: "insurance asuransi" },
  shirt: { Icon: Shirt, words: "clothes baju fashion" },
  sofa: { Icon: Sofa, words: "furniture perabot" },
  sparkles: { Icon: Sparkles, words: "beauty skincare perawatan" },
  stethoscope: { Icon: Stethoscope, words: "doctor dokter rumah sakit" },
  tag: { Icon: Tag, words: "other lainnya" },
  tent: { Icon: Tent, words: "camping liburan" },
  ticket: { Icon: Ticket, words: "tiket event konser" },
  train: { Icon: TrainFront, words: "transport kereta krl mrt" },
  tree: { Icon: TreePine, words: "nature alam" },
  "trending-up": { Icon: TrendingUp, words: "investment investasi saham" },
  tv: { Icon: Tv, words: "streaming netflix" },
  users: { Icon: Users, words: "family keluarga" },
  utensils: { Icon: Utensils, words: "food makan restoran" },
  wallet: { Icon: Wallet, words: "money uang dompet gaji" },
  wifi: { Icon: Wifi, words: "internet" },
  wrench: { Icon: Wrench, words: "repair servis bengkel" },
  zap: { Icon: Zap, words: "electricity listrik" },
};

export const categoryIconNames = Object.keys(icons);

/** Finds icons by name or by what they're for, in English or Indonesian. */
export function searchCategoryIcons(query: string) {
  const needle = query.trim().toLowerCase();
  return categoryIconNames.filter((name) =>
    `${name} ${icons[name]?.words}`.includes(needle),
  );
}

/** Any chosen color stays readable, because the icon leans toward the theme's text color. */
export const categoryStyle = (color?: string): CSSProperties | undefined =>
  color
    ? {
        background: `color-mix(in srgb, ${color} 16%, transparent)`,
        color: `color-mix(in srgb, ${color} 75%, var(--text))`,
      }
    : undefined;

export function CategoryIcon({
  className = "size-5",
  icon,
}: {
  className?: string;
  icon: string;
}) {
  const { Icon } = icons[icon] ?? icons.tag ?? { Icon: Tag };
  return <Icon aria-hidden="true" className={className} />;
}

export function TransactionIcon({
  color,
  icon,
}: {
  color?: string;
  icon?: string;
}) {
  return icon === "transfer" ? (
    <div className="tx-icon cat-swap">
      <ArrowLeftRight aria-hidden="true" className="size-5" />
    </div>
  ) : (
    <div className="tx-icon" style={categoryStyle(color)}>
      <CategoryIcon icon={icon ?? ""} />
    </div>
  );
}
