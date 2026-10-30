const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

const compact = new Intl.NumberFormat('id-ID', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const grouped = new Intl.NumberFormat('id-ID')

export const formatRupiah = (value: number) => rupiah.format(value)

export const formatCompact = (value: number) => compact.format(value)

export const formatGrouped = (value: number) => grouped.format(value)

/** Mengubah Date menjadi YYYY-MM-DD menurut zona waktu lokal. */
export function toIsoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** YYYY-MM-DD harus dibaca sebagai waktu lokal agar tanggalnya tidak bergeser. */
export const parseIsoDate = (iso: string) => new Date(`${iso}T00:00:00`)

export const monthKey = (date: Date) => toIsoDate(date).slice(0, 7)

export const formatMonth = (date: Date) =>
  date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

export const formatMonthShort = (date: Date) =>
  date.toLocaleDateString('id-ID', { month: 'short' })

export function formatDayHeading(iso: string) {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (iso === toIsoDate(today)) return 'Hari ini'
  if (iso === toIsoDate(yesterday)) return 'Kemarin'
  return parseIsoDate(iso).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export const formatDayShort = (iso: string) =>
  parseIsoDate(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
