import type {
  AccountInterface,
  AssetInterface,
  BudgetInterface,
  CategoryInterface,
  TransactionInterface,
  TransactionSource,
  TransactionType,
} from "@fynlo/types";

import { toIsoDate } from "@/utils/format";

export const accounts: AccountInterface[] = [
  {
    color: "#facc15",
    id: "jago",
    kind: "bank",
    mask: "1904",
    name: "Jago Main Pocket",
    openingBalance: 9_000_000,
    source: "shortcut",
  },
  {
    color: "#f97316",
    id: "bni",
    kind: "bank",
    mask: "4821",
    name: "BNI / wondr",
    openingBalance: 2_000_000,
    source: "email",
  },
  {
    color: "#334155",
    id: "cash",
    kind: "cash",
    mask: "6012",
    name: "Cash",
    openingBalance: 3_000_000,
    source: "manual",
  },
];

export const assets: AssetInterface[] = [
  {
    id: "mutual-fund",
    kind: "investment",
    name: "Mutual fund",
    value: 12_500_000,
  },
  { id: "stocks", kind: "investment", name: "Stocks", value: 6_750_000 },
  { id: "gold", kind: "gold", name: "Gold, 10 grams", value: 13_000_000 },
  { id: "motorcycle", kind: "vehicle", name: "Motorcycle", value: 18_000_000 },
];

export const categories: CategoryInterface[] = [
  {
    color: "#059669",
    icon: "wallet",
    id: "salary",
    name: "Salary",
    type: "income",
  },
  {
    color: "#0ea5e9",
    icon: "laptop",
    id: "freelance",
    name: "Freelance",
    type: "income",
  },
  {
    color: "#059669",
    icon: "utensils",
    id: "food",
    name: "Food & Drinks",
    type: "expense",
  },
  {
    color: "#0ea5e9",
    icon: "car",
    id: "transport",
    name: "Transport",
    type: "expense",
  },
  {
    color: "#8b5cf6",
    icon: "bag",
    id: "shopping",
    name: "Shopping",
    type: "expense",
  },
  {
    color: "#f59e0b",
    icon: "receipt",
    id: "bills",
    name: "Bills",
    type: "expense",
  },
  {
    color: "#e11d48",
    icon: "home",
    id: "housing",
    name: "Housing",
    type: "expense",
  },
  {
    color: "#64748b",
    icon: "film",
    id: "fun",
    name: "Entertainment",
    type: "expense",
  },
];

export const budgets: BudgetInterface[] = [
  { categoryId: "housing", limit: 2_200_000 },
  { categoryId: "food", limit: 2_000_000 },
  { categoryId: "transport", limit: 600_000 },
  { categoryId: "bills", limit: 800_000 },
  { categoryId: "shopping", limit: 700_000 },
  { categoryId: "fun", limit: 400_000 },
];

type Row = [
  day: number,
  time: string,
  type: TransactionType,
  amount: number,
  categoryId: string,
  accountId: string,
  source: TransactionSource,
  name: string,
  detail: string,
];

const monthlyRows: Row[] = [
  [
    1,
    "09:04",
    "income",
    8_500_000,
    "salary",
    "bni",
    "email",
    "Monthly salary",
    "PT Karya Digital Indonesia",
  ],
  [
    1,
    "10:12",
    "expense",
    2_200_000,
    "housing",
    "bni",
    "manual",
    "Room rent",
    "Monthly rent",
  ],
  [
    2,
    "12:30",
    "expense",
    85_000,
    "food",
    "jago",
    "shortcut",
    "Kopi Tuku",
    "QRIS TUKU CIPETE",
  ],
  [
    3,
    "20:16",
    "expense",
    450_000,
    "bills",
    "bni",
    "email",
    "PLN postpaid",
    "Electricity bill",
  ],
  [
    4,
    "07:35",
    "expense",
    120_000,
    "transport",
    "jago",
    "shortcut",
    "Grab Transport",
    "Ride to the office",
  ],
  [
    5,
    "18:45",
    "expense",
    340_000,
    "food",
    "bni",
    "email",
    "Superindo",
    "Kitchen groceries",
  ],
  [
    7,
    "08:00",
    "expense",
    275_000,
    "bills",
    "bni",
    "email",
    "IndiHome",
    "Home internet",
  ],
  [
    8,
    "18:01",
    "expense",
    65_000,
    "fun",
    "jago",
    "email",
    "Spotify",
    "Premium plan",
  ],
  [
    10,
    "14:21",
    "expense",
    410_000,
    "shopping",
    "bni",
    "shortcut",
    "Tokopedia",
    "Shoes",
  ],
  [
    12,
    "17:20",
    "expense",
    150_000,
    "transport",
    "cash",
    "manual",
    "Pertamina",
    "Fuel",
  ],
  [
    14,
    "11:00",
    "income",
    1_500_000,
    "freelance",
    "bni",
    "email",
    "Design project",
    "Client payment",
  ],
  [
    15,
    "19:10",
    "expense",
    410_000,
    "food",
    "bni",
    "email",
    "Superindo",
    "Monthly groceries",
  ],
  [17, "20:30", "expense", 180_000, "fun", "bni", "email", "CGV", "Cinema"],
  [
    19,
    "19:40",
    "expense",
    95_000,
    "food",
    "cash",
    "manual",
    "Warung Sate",
    "Dinner",
  ],
  [
    22,
    "07:35",
    "expense",
    130_000,
    "transport",
    "jago",
    "shortcut",
    "Grab Transport",
    "Ride to the office",
  ],
  [
    24,
    "19:15",
    "expense",
    260_000,
    "food",
    "jago",
    "shortcut",
    "Sushi Tei",
    "Dinner with friends",
  ],
  [
    26,
    "14:21",
    "expense",
    195_000,
    "shopping",
    "jago",
    "shortcut",
    "Tokopedia",
    "Household supplies",
  ],
  [
    28,
    "08:42",
    "expense",
    72_000,
    "food",
    "cash",
    "shortcut",
    "Kopi Tuku",
    "Breakfast",
  ],
];

// Generated relative to today so the prototype always has current-month data.
function generateTransactions(monthsBack: number) {
  const today = new Date();
  const result: TransactionInterface[] = [];
  for (let offset = monthsBack; offset >= 0; offset--) {
    // Small variation so trends are not flat, plus a food bump for this month's insight.
    const scale = 1 + ((offset * 7) % 5) * 0.06;
    const foodBump = offset === 0 ? 1.25 : 1;
    monthlyRows.forEach(
      (
        [day, time, type, amount, categoryId, accountId, source, name, detail],
        index,
      ) => {
        const lastDay = new Date(
          today.getFullYear(),
          today.getMonth() - offset + 1,
          0,
        ).getDate();
        const clampedDay =
          offset === 0
            ? Math.min(day, today.getDate())
            : Math.min(day, lastDay);
        const date = new Date(
          today.getFullYear(),
          today.getMonth() - offset,
          clampedDay,
        );
        const isFixed = categoryId === "salary" || categoryId === "housing";
        result.push({
          accountId,
          amount: isFixed
            ? amount
            : Math.round(
                (amount * scale * (categoryId === "food" ? foodBump : 1)) /
                  1000,
              ) * 1000,
          categoryId,
          date: toIsoDate(date),
          detail,
          id: `seed-${offset}-${String(index).padStart(2, "0")}`,
          name,
          source,
          // The three newest automatic entries wait for the weekly review.
          status:
            offset === 0 && index >= monthlyRows.length - 3
              ? "review"
              : "verified",
          time,
          type,
        });
      },
    );
  }
  return result;
}

export const seedTransactions = generateTransactions(5);
