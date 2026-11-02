export type OrderStatus =
  | 'QUEUED'
  | 'COOKING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED'

export type PaymentStatus =
  | 'UNPAID'
  | 'PENDING'
  | 'PAID'
  | 'EXPIRED'
  | 'FAILED'

export type PaymentMethod = 'QRIS' | 'CASH'

export type StaffRole = 'CASHIER' | 'BARISTA' | 'ADMIN'

export type TasteMood = 'santai' | 'fokus' | 'segar'
export type TasteFlavor = 'manis' | 'pahit_bold' | 'asam_segar' | 'creamy'
export type TasteFormat = 'dingin' | 'panas' | 'cemilan'

export interface MenuItemDTO {
  id: string
  name: string
  description: string
  price: number
  image?: string | null
  category: string
  isAvailable: boolean
  isPopular: boolean
  tagMood?: string | null
  tagFlavor?: string | null
  tagFormat?: string | null
}

