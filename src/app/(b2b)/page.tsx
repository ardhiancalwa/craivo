import type { Metadata } from 'next'
import { getCafeConfig } from '@/lib/server/config-service'
import { B2BLandingView } from '@/components/b2b/b2b-landing-view'

export const dynamic = 'force-dynamic'

const FAVICON_SVG_DATA_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%231B1C1A'/%3E%3Ctext x='16' y='22' text-anchor='middle' font-family='sans-serif' font-size='18' font-weight='700' fill='%23924805'%3EC%3C/text%3E%3C/svg%3E"

export const metadata: Metadata = {
  title: 'Cravio — Your craving, perfectly matched | Platform Pemesanan Meja Kafe & Resto',
  description:
    'Pelanggan memilih menu dan membayar dari ponsel. Kasir dan dapur menerima informasi yang jelas untuk melanjutkan pesanan.',
  icons: {
    icon: FAVICON_SVG_DATA_URI,
  },
  openGraph: {
    title: 'Cravio — Your craving, perfectly matched',
    description:
      'Pelanggan memilih menu dan membayar dari ponsel. Kasir dan dapur menerima informasi yang jelas untuk melanjutkan pesanan.',
    type: 'website',
    locale: 'id_ID',
    siteName: 'Cravio',
  },
  alternates: {
    canonical: '/',
  },
}

/**
 * Daftar nomor & alamat contoh dari seed/test yang dilarang ditampilkan sebagai kontak publik resmi.
 */
const SEED_PLACEHOLDER_DIGITS = new Set([
  '081234567890',
  '6281234567890',
  '081299887766',
  '6281299887766',
])

function isSeedPlaceholderAddress(address: string | null | undefined): boolean {
  if (!address) return true
  const normalized = address.trim().toLowerCase()
  return normalized.length === 0 || normalized.includes('jl. senopati')
}

function resolveOfficialWhatsapp(rawPhone: string): {
  hasValidWhatsapp: boolean
  internationalNumber: string
  displayPhone: string | null
} {
  const trimmed = rawPhone.trim()
  const cleanDigits = trimmed.replace(/\D/g, '')

  if (!cleanDigits || SEED_PLACEHOLDER_DIGITS.has(cleanDigits)) {
    return {
      hasValidWhatsapp: false,
      internationalNumber: '',
      displayPhone: null,
    }
  }

  if (cleanDigits.startsWith('08') && cleanDigits.length >= 10 && cleanDigits.length <= 14) {
    return {
      hasValidWhatsapp: true,
      internationalNumber: `62${cleanDigits.slice(1)}`,
      displayPhone: trimmed,
    }
  }

  if (cleanDigits.startsWith('628') && cleanDigits.length >= 11 && cleanDigits.length <= 15) {
    return {
      hasValidWhatsapp: true,
      internationalNumber: cleanDigits,
      displayPhone: trimmed,
    }
  }

  return {
    hasValidWhatsapp: false,
    internationalNumber: '',
    displayPhone: null,
  }
}

export default async function B2BLandingPage() {
  const config = await getCafeConfig().catch(() => ({
    name: 'Cravio',
    tagline: 'Your craving, perfectly matched',
    address: null,
    phone: null,
  }))

  const explicitEnvWhatsapp = process.env.NEXT_PUBLIC_B2B_WHATSAPP?.trim() || ''
  const candidatePhone = explicitEnvWhatsapp || config.phone || ''
  const { hasValidWhatsapp, internationalNumber, displayPhone } =
    resolveOfficialWhatsapp(candidatePhone)

  const confirmedAddress = isSeedPlaceholderAddress(config.address)
    ? null
    : config.address?.trim() || null

  const confirmedPrice = process.env.NEXT_PUBLIC_B2B_CONFIRMED_PRICE?.trim() || null

  const prefilledMessage =
    'Halo, saya ingin menanyakan informasi implementasi platform Cravio untuk operasional kafe kami.'
  const whatsappUrl = hasValidWhatsapp
    ? `https://wa.me/${internationalNumber}?text=${encodeURIComponent(prefilledMessage)}`
    : ''

  return (
    <main>
      <B2BLandingView
        cafeName={config.name || 'Cravio'}
        cafeTagline={config.tagline || 'Your craving, perfectly matched'}
        confirmedAddress={confirmedAddress}
        confirmedPhone={displayPhone}
        confirmedPrice={confirmedPrice}
        whatsappUrl={whatsappUrl}
        hasValidWhatsapp={hasValidWhatsapp}
      />
    </main>
  )
}
