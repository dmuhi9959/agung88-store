export type Category = {
  value: string
  label: string
  icon: string
  description: string
}

export type StbType = {
  value: string
  label: string
  brand: string
}

export const CATEGORIES: Category[] = [
  {
    value: 'all',
    label: 'Semua',
    icon: 'Boxes',
    description: 'Tampilkan semua mod STB',
  },
  {
    value: 'rom',
    label: 'ROM / Firmware',
    icon: 'CircuitBoard',
    description: 'Custom ROM dan firmware untuk STB',
  },
  {
    value: 'app',
    label: 'Aplikasi',
    icon: 'AppWindow',
    description: 'Aplikasi modifikasi untuk STB',
  },
  {
    value: 'launcher',
    label: 'Launcher',
    icon: 'LayoutGrid',
    description: 'Launcher custom untuk Android TV',
  },
  {
    value: 'codec',
    label: 'Codec',
    icon: 'FileVideo',
    description: 'Paket codec untuk pemutar video',
  },
  {
    value: 'system',
    label: 'System / Root',
    icon: 'Shield',
    description: 'Modifikasi sistem dan root',
  },
  {
    value: 'recovery',
    label: 'Recovery',
    icon: 'LifeBuoy',
    description: 'Custom recovery seperti TWRP',
  },
  {
    value: 'theme',
    label: 'Tema / Skin',
    icon: 'Palette',
    description: 'Tema dan skin kustom',
  },
  {
    value: 'tool',
    label: 'Tool / Utility',
    icon: 'Wrench',
    description: 'Tool utility untuk STB',
  },
]

export const STB_TYPES: StbType[] = [
  { value: 'all', label: 'Semua STB', brand: 'Universal' },
  { value: 'android-tv', label: 'Android TV', brand: 'Universal' },
  { value: 'b860h', label: 'B860H', brand: 'Huawei' },
  { value: 'evictrio-v1', label: 'Evictrio V1', brand: 'Evictrio' },
  { value: 'mibox-s', label: 'Mi Box S', brand: 'Xiaomi' },
  { value: 'indibox', label: 'IndiBox', brand: 'IndiBox' },
  { value: 'zlt-s10', label: 'ZLT S10', brand: 'ZLT' },
  { value: 'other', label: 'Lainnya', brand: 'Universal' },
]

export function getCategoryByValue(value: string): Category | undefined {
  return CATEGORIES.find((c) => c.value === value)
}

export function getStbTypeByValue(value: string): StbType | undefined {
  return STB_TYPES.find((t) => t.value === value)
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)

  if (years > 0) return `${years} tahun lalu`
  if (months > 0) return `${months} bulan lalu`
  if (days > 0) return `${days} hari lalu`
  if (hours > 0) return `${hours} jam lalu`
  if (minutes > 0) return `${minutes} menit lalu`
  return 'Baru saja'
}
