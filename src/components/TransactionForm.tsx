import { useState, type FormEvent } from 'react'
import { formatGrouped, toIsoDate } from '../lib/format'
import { useFinance } from '../store/finance'
import type { TransactionType } from '../types'
import { CategoryIcon } from './CategoryIcon'
import { Button } from './ui/Button'
import { Field, fieldClass } from './ui/Input'
import { Segmented } from './ui/Segmented'

export function TransactionForm({ onSaved }: { onSaved: () => void }) {
  const { accounts, categories, addTransaction } = useFinance()
  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState(0)
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState(accounts[0].id)
  const [date, setDate] = useState(toIsoDate(new Date()))
  const [note, setNote] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const options = categories.filter((c) => c.type === type)
  const amountError = submitted && amount <= 0 ? 'Masukkan nominal lebih dari 0' : undefined
  const categoryError = submitted && !categoryId ? 'Pilih satu kategori' : undefined

  function changeType(next: TransactionType) {
    setType(next)
    setCategoryId('')
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (amount <= 0 || !categoryId || !date) return
    addTransaction({ type, amount, categoryId, accountId, date, note: note.trim() })
    onSaved()
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Segmented
        label="Jenis transaksi"
        value={type}
        onChange={changeType}
        options={[
          { value: 'expense', label: 'Pengeluaran' },
          { value: 'income', label: 'Pemasukan' },
        ]}
      />

      <Field label="Nominal" error={amountError}>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-lg font-semibold text-muted">
            Rp
          </span>
          <input
            autoFocus
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            value={amount ? formatGrouped(amount) : ''}
            onChange={(event) => setAmount(Number(event.target.value.replace(/\D/g, '').slice(0, 13)))}
            className={`${fieldClass} min-h-14 pl-11 text-2xl! font-semibold tabular-nums`}
          />
        </div>
      </Field>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Kategori</legend>
        <div className="grid grid-cols-3 gap-2">
          {options.map((category) => (
            <button
              key={category.id}
              type="button"
              aria-pressed={category.id === categoryId}
              onClick={() => setCategoryId(category.id)}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-xs font-medium transition ${
                category.id === categoryId
                  ? 'border-accent bg-accent-soft text-ink'
                  : 'border-line text-muted hover:text-ink'
              }`}
            >
              <CategoryIcon icon={category.icon} />
              <span className="text-center leading-tight">{category.name}</span>
            </button>
          ))}
        </div>
        {categoryError && <p className="mt-1.5 text-sm text-expense">{categoryError}</p>}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Akun">
          <select value={accountId} onChange={(event) => setAccountId(event.target.value)} className={fieldClass}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tanggal">
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={fieldClass} />
        </Field>
      </div>

      <Field label="Catatan (opsional)">
        <input
          value={note}
          maxLength={60}
          placeholder="Contoh: makan siang"
          onChange={(event) => setNote(event.target.value)}
          className={fieldClass}
        />
      </Field>

      <Button type="submit" className="w-full">
        Simpan transaksi
      </Button>
    </form>
  )
}
