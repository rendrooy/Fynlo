import { CategoryIcon } from '../components/CategoryIcon'
import { PageHeader } from '../components/PageHeader'
import { Card } from '../components/ui/Card'
import { Segmented } from '../components/ui/Segmented'
import { accountBalance } from '../lib/finance'
import { formatRupiah } from '../lib/format'
import { useFinance } from '../store/finance'
import { useTheme } from '../store/theme'
import type { AccountKind } from '../types'

const accountKinds: Record<AccountKind, string> = {
  bank: 'Rekening bank',
  ewallet: 'Dompet digital',
  cash: 'Uang tunai',
}

export function SettingsPage() {
  const { accounts, categories, transactions } = useFinance()
  const { theme, setTheme } = useTheme()

  return (
    <>
      <PageHeader title="Pengaturan" />

      <div className="grid max-w-3xl gap-4">
        <Card>
          <h2 className="text-sm font-semibold">Tampilan</h2>
          <p className="mt-0.5 mb-3 text-sm text-muted">Pilih tema aplikasi.</p>
          <Segmented
            label="Tema"
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'light', label: 'Terang' },
              { value: 'dark', label: 'Gelap' },
            ]}
          />
        </Card>

        <Card>
          <h2 className="mb-1 text-sm font-semibold">Akun</h2>
          <ul className="divide-y divide-line">
            {accounts.map((account) => (
              <li key={account.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{account.name}</p>
                  <p className="text-xs text-muted">{accountKinds[account.kind]}</p>
                </div>
                <p className="text-sm font-semibold tabular-nums">
                  {formatRupiah(accountBalance(account, transactions))}
                </p>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold">Kategori</h2>
          <ul className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <li
                key={category.id}
                className="flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1.5 text-sm"
              >
                <CategoryIcon icon={category.icon} className="size-4 text-muted" />
                {category.name}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}
