import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import B2BLandingPage from '@/app/(b2b)/page'
import prisma from '@/lib/server/db'

describe('Tahap 20: SELA B2B Editorial Landing Page & Motion Integration Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('renders editorial SELA hero, permanent simulation label, pause control, and full content integrity', async () => {
    const pageJsx = await B2BLandingPage()
    const { container } = render(pageJsx)

    // 1. Hero headline & description per specification
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /pesanan dari meja\.\s*alurnya sampai ke dapur\./i,
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /pelanggan memilih menu dan membayar dari ponsel\. kasir dan dapur menerima informasi yang jelas untuk melanjutkan pesanan\./i
      )
    ).toBeInTheDocument()

    // 2. Motion graphics permanent label & keyboard-accessible pause/play button
    expect(screen.getByText(/simulasi alur pemesanan/i)).toBeInTheDocument()
    const pauseBtn = screen.getByRole('button', {
      name: /jeda simulasi alur pemesanan/i,
    })
    expect(pauseBtn).toBeInTheDocument()
    fireEvent.click(pauseBtn)
    expect(
      screen.getByRole('button', { name: /putar simulasi alur pemesanan/i })
    ).toBeInTheDocument()

    // 3. Operational context, process diagram, and 4 system modules
    expect(
      screen.getByRole('heading', {
        name: /menjaga koordinasi antara meja, kasir, dan bar kopi\./i,
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: /empat tahap berurutan dari meja hingga penyajian\./i,
      })
    ).toBeInTheDocument()
    expect(screen.getByText(/menu meja & kurasi preferensi/i)).toBeInTheDocument()
    expect(screen.getByText(/midtrans core api & rekonsiliasi/i)).toBeInTheDocument()
    expect(screen.getByText(/operasional kasir, antrean masak, & struk/i)).toBeInTheDocument()
    expect(screen.getByText(/katalog, kuis, laporan wib, & master qr/i)).toBeInTheDocument()

    // 4. Interactive Quiz Preview label
    expect(screen.getByText(/simulasi \/ interactive preview/i)).toBeInTheDocument()

    // 5. Commercial integrity: does not unilaterally publish Rp750.000 or Rp2.500.000 when unconfirmed
    expect(
      screen.getByRole('heading', {
        name: /ruang lingkup implementasi dan pembagian tanggung jawab\./i,
      })
    ).toBeInTheDocument()
    expect(screen.queryByText(/750\.000/)).not.toBeInTheDocument()
    expect(screen.queryByText(/2\.500\.000/)).not.toBeInTheDocument()

    // 6. Operational FAQ & Footer
    expect(
      screen.getByRole('heading', { name: /faq operasional kafe\./i })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/apakah pelanggan perlu mengunduh aplikasi atau membuat akun\?/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/cravio — your craving, perfectly matched/i)
    ).toBeInTheDocument()

    expect(container).toBeDefined()
  }, 20000)

  it('runs 3-step Demo Quiz (Suasana -> Rasa -> Format/Suhu) in-memory without DB mutations', async () => {
    const createOrderSpy = vi.spyOn(prisma.order, 'create')
    const updateOrderSpy = vi.spyOn(prisma.order, 'update')
    const createPaymentSpy = vi.spyOn(prisma.paymentAttempt, 'create')

    const pageJsx = await B2BLandingPage()
    render(pageJsx)

    // Step 1: Suasana
    expect(
      screen.getByText(/bagaimana suasana kunjungan saat ini\?/i)
    ).toBeInTheDocument()
    const santaiBtn = screen.getByRole('button', { name: /santai & rileks/i })

    vi.useFakeTimers()
    fireEvent.click(santaiBtn)
    act(() => {
      vi.advanceTimersByTime(220)
    })

    // Step 2: Rasa
    expect(
      screen.getByText(/karakter rasa apa yang diinginkan\?/i)
    ).toBeInTheDocument()
    const creamyBtn = screen.getByRole('button', { name: /creamy & gurih/i })
    fireEvent.click(creamyBtn)
    act(() => {
      vi.advanceTimersByTime(220)
    })

    // Step 3: Format/Suhu
    expect(
      screen.getByText(/format atau suhu sajian yang dipilih\?/i)
    ).toBeInTheDocument()
    const cemilanBtn = screen.getByRole('button', { name: /kudapan \/ pastry/i })
    fireEvent.click(cemilanBtn)
    act(() => {
      vi.advanceTimersByTime(220)
    })

    // Result screen
    expect(screen.getByText(/hasil rekomendasi contoh/i)).toBeInTheDocument()
    expect(screen.getByText(/french butter croissant/i)).toBeInTheDocument()

    // Reset works cleanly
    const resetBtn = screen.getByRole('button', { name: /ulangi simulasi kuis/i })
    fireEvent.click(resetBtn)
    expect(
      screen.getByText(/bagaimana suasana kunjungan saat ini\?/i)
    ).toBeInTheDocument()

    expect(createOrderSpy).not.toHaveBeenCalled()
    expect(updateOrderSpy).not.toHaveBeenCalled()
    expect(createPaymentSpy).not.toHaveBeenCalled()
  })

  it('blocks placeholder phones from fabricating fake WhatsApp links and encodes official configured WhatsApp safely', async () => {
    // 1. Default environment without NEXT_PUBLIC_B2B_WHATSAPP (only seed/test placeholder in DB)
    const unconfiguredJsx = await B2BLandingPage()
    const { unmount } = render(unconfiguredJsx)
    expect(document.querySelectorAll('a[href*="wa.me"]').length).toBe(0)
    expect(
      screen.getByText(/kontak whatsapp resmi belum dikonfigurasi/i)
    ).toBeInTheDocument()
    unmount()

    // 2. When official B2B WhatsApp is configured via environment
    vi.stubEnv('NEXT_PUBLIC_B2B_WHATSAPP', '081388001122')
    const configuredJsx = await B2BLandingPage()
    render(configuredJsx)

    const waLinks = screen.getAllByRole('link', { name: /whatsapp/i })
    expect(waLinks.length).toBeGreaterThanOrEqual(2)

    const firstHref = waLinks[0]?.getAttribute('href')
    expect(firstHref).toMatch(/^https:\/\/wa\.me\/6281388001122\?text=/)
    expect(firstHref).not.toContain(' ')
  })

  it('guarantees zero secret leaks in rendered HTML', async () => {
    const pageJsx = await B2BLandingPage()
    const { container } = render(pageJsx)
    const htmlContent = container.innerHTML

    if (process.env.JWT_SECRET) {
      expect(htmlContent).not.toContain(process.env.JWT_SECRET)
    }
    if (process.env.MIDTRANS_SERVER_KEY) {
      expect(htmlContent).not.toContain(process.env.MIDTRANS_SERVER_KEY)
    }
    if (process.env.DATABASE_URL) {
      expect(htmlContent).not.toContain(process.env.DATABASE_URL)
    }

    expect(htmlContent).not.toMatch(/\$2[aby]\$\d{2}\$[./0-9A-Za-z]{53}/)
    expect(htmlContent).not.toContain('staff_secret_token')
    expect(htmlContent).not.toContain('orderSecretToken')
  })
})
