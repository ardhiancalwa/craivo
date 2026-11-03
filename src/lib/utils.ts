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

/**
 * Salin teks ke papan klip (clipboard) dengan dukungan lintas peramban
 * (Safari iOS, Chrome, Edge, Opera Mini/Mobile, Android Webview).
 * Menyediakan fallback document.execCommand bila navigator.clipboard dibatasi.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined' || !text) return false

  // 1. Coba navigator.clipboard standar (modern secure context)
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Lanjut ke fallback jika diblokir izin/sandbox
    }
  }

  // 2. Fallback textarea element untuk iOS Safari & browser mobile/webview
  try {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.setAttribute('readonly', '')
    textArea.style.position = 'fixed'
    textArea.style.top = '0'
    textArea.style.left = '0'
    textArea.style.width = '2em'
    textArea.style.height = '2em'
    textArea.style.padding = '0'
    textArea.style.border = 'none'
    textArea.style.outline = 'none'
    textArea.style.boxShadow = 'none'
    textArea.style.background = 'transparent'
    textArea.style.fontSize = '16px' // Mencegah iOS auto-zoom
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)
    return successful
  } catch {
    return false
  }
}


