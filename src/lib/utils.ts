import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combines Tailwind classes cleanly and safely without conflicts.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats an integer amount in IDR to canonical SELA standard (e.g. 28000 -> "Rp28.000").
 * Never displays decimal zeros (,00).
 */
export function formatIDR(amount: number): string {
  const integerPart = Math.round(amount)
  return `Rp${integerPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
}

/**
 * Generates an order number with prefix ORD, date stamp, and sequence/random suffix.
 * e.g., ORD-20261028-001
 */
export function formatOrderNumber(date: Date, seq: number): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const sequence = String(seq).padStart(3, '0')
  return `ORD-${yyyy}${mm}${dd}-${sequence}`
}

