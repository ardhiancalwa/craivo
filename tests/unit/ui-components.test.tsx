import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  Button,
  Input,
  Textarea,
  Badge,
  QuantityStepper,
  Dialog,
  BottomSheet,
  ConnectionBanner,
  EmptyState,
  ErrorState,
} from '@/components/ui'
import DevUiPage from '@/app/dev/ui/page'
import * as navigation from 'next/navigation'

// Mock next/navigation for DevUiPage test
vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
  useSearchParams: () => new URLSearchParams('table=07'),
  usePathname: () => '/menu',
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

describe('Atomic UI Components Suite (SELA Design System)', () => {
  describe('Button Component', () => {
    it('renders with standard touch target >= 44px (min-h-touch)', () => {
      render(<Button>Pesan Sekarang</Button>)
      const btn = screen.getByRole('button', { name: /pesan sekarang/i })
      expect(btn).toBeInTheDocument()
      expect(btn.className).toContain('min-h-touch')
    })

    it('renders KDS button with jumbo touch target >= 56px (min-h-touch-kds)', () => {
      render(
        <Button variant="kds" size="kds">
          Mulai Dibuat (KDS)
        </Button>
      )
      const btn = screen.getByRole('button', { name: /mulai dibuat/i })
      expect(btn.className).toContain('min-h-touch-kds')
      expect(btn.className).toContain('text-lg')
    })

    it('handles click events properly', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Klik Saya</Button>)
      fireEvent.click(screen.getByRole('button', { name: /klik saya/i }))
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('disables click and sets aria-busy when isLoading is true', () => {
      const handleClick = vi.fn()
      render(
        <Button isLoading loadingText="Memproses..." onClick={handleClick}>
          Kirim
        </Button>
      )
      const btn = screen.getByRole('button')
      expect(btn).toBeDisabled()
      expect(btn).toHaveAttribute('aria-busy', 'true')
      expect(screen.getByText('Memproses...')).toBeInTheDocument()

      fireEvent.click(btn)
      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('Input and Textarea Components', () => {
    it('associates label with input using generated or explicit ID', () => {
      render(<Input label="Nama Pemesan" id="customer-name" />)
      const input = screen.getByLabelText(/nama pemesan/i)
      expect(input).toBeInTheDocument()
      expect(input.id).toBe('customer-name')
    })

    it('sets aria-invalid="true" and renders error message when error is provided', () => {
      render(<Input label="Email" error="Email wajib diisi" />)
      const input = screen.getByLabelText(/email/i)
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByRole('alert')).toHaveTextContent('Email wajib diisi')
    })

    it('renders textarea with character counter', () => {
      render(
        <Textarea
          label="Catatan"
          maxLength={120}
          showCount
          defaultValue="Sedikit es"
        />
      )
      expect(screen.getByText('10/120')).toBeInTheDocument()
    })
  })

  describe('Badge Component (Dual-Encoding)', () => {
    it('renders text with icon for WCAG dual-encoding compliance', () => {
      render(
        <Badge
          variant="paid"
          icon={<span data-testid="check-icon">✓</span>}
        >
          Lunas
        </Badge>
      )
      expect(screen.getByTestId('check-icon')).toBeInTheDocument()
      expect(screen.getByText('Lunas')).toBeInTheDocument()
    })

    it('renders pulsing indicator for table badge', () => {
      const { container } = render(<Badge variant="table">Meja 07</Badge>)
      expect(screen.getByText('Meja 07')).toBeInTheDocument()
      const pulsingDot = container.querySelector('.animate-pulse')
      expect(pulsingDot).toBeInTheDocument()
    })
  })

  describe('QuantityStepper Component', () => {
    it('increments and decrements value within min and max bounds', () => {
      const handleChange = vi.fn()
      render(<QuantityStepper value={2} onChange={handleChange} min={1} max={5} />)

      const decBtn = screen.getByRole('button', { name: /kurangi jumlah/i })
      const incBtn = screen.getByRole('button', { name: /tambah jumlah/i })

      fireEvent.click(incBtn)
      expect(handleChange).toHaveBeenCalledWith(3)

      fireEvent.click(decBtn)
      expect(handleChange).toHaveBeenCalledWith(1)
    })

    it('disables decrement button when value reaches min bound', () => {
      render(<QuantityStepper value={1} onChange={vi.fn()} min={1} />)
      const decBtn = screen.getByRole('button', { name: /kurangi jumlah/i })
      expect(decBtn).toBeDisabled()
    })

    it('renders inline capsule variant with tabular numbers', () => {
      render(<QuantityStepper value={3} onChange={vi.fn()} variant="inline" />)
      const numSpan = screen.getByText('3')
      expect(numSpan.className).toContain('tabular-nums')
    })
  })

  describe('Dialog and BottomSheet Accessibility', () => {
    it('locks body scroll when opened and restores when closed', () => {
      const { rerender } = render(
        <Dialog isOpen={true} onClose={vi.fn()} title="Dialog Judul">
          <p>Konten Dialog</p>
        </Dialog>
      )
      expect(document.body.style.overflow).toBe('hidden')

      rerender(
        <Dialog isOpen={false} onClose={vi.fn()} title="Dialog Judul">
          <p>Konten Dialog</p>
        </Dialog>
      )
      expect(document.body.style.overflow).not.toBe('hidden')
    })

    it('closes on Escape key press in Dialog', () => {
      const handleClose = vi.fn()
      render(
        <Dialog isOpen={true} onClose={handleClose} title="Dialog Judul">
          <p>Konten Dialog</p>
        </Dialog>
      )

      fireEvent.keyDown(window, { key: 'Escape' })
      expect(handleClose).toHaveBeenCalledTimes(1)
    })

    it('closes on Escape key press in BottomSheet', () => {
      const handleClose = vi.fn()
      render(
        <BottomSheet isOpen={true} onClose={handleClose} title="Sheet Judul">
          <p>Konten Sheet</p>
        </BottomSheet>
      )

      fireEvent.keyDown(window, { key: 'Escape' })
      expect(handleClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('ConnectionBanner Component', () => {
    it('displays offline warning when offline event is dispatched', () => {
      render(<ConnectionBanner />)

      // Initially online, banner is null
      expect(
        screen.queryByText(/koneksi internet terputus/i)
      ).not.toBeInTheDocument()

      // Trigger offline event
      fireEvent(window, new Event('offline'))
      expect(
        screen.getByText(/koneksi internet terputus/i)
      ).toBeInTheDocument()
    })
  })

  describe('EmptyState and ErrorState', () => {
    it('renders EmptyState with title, description, and action button', () => {
      const handleAction = vi.fn()
      render(
        <EmptyState
          title="Keranjang Kosong"
          description="Silakan pilih menu."
          actionLabel="Pilih Menu"
          onAction={handleAction}
        />
      )
      expect(screen.getByText('Keranjang Kosong')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /pilih menu/i }))
      expect(handleAction).toHaveBeenCalledTimes(1)
    })

    it('renders ErrorState and handles retry callback', () => {
      const handleRetry = vi.fn()
      render(
        <ErrorState
          title="Gagal Memuat"
          message="Server tidak dapat dihubungi."
          onRetry={handleRetry}
        />
      )
      expect(screen.getByText('Gagal Memuat')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /coba lagi/i }))
      expect(handleRetry).toHaveBeenCalledTimes(1)
    })
  })

  describe('Dev UI Security Guard', () => {
    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('invokes notFound() when NODE_ENV is production', () => {
      vi.stubEnv('NODE_ENV', 'production')
      DevUiPage()
      expect(navigation.notFound).toHaveBeenCalled()
    })
  })
})
