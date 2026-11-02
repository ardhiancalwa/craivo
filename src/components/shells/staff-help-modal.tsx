'use client'

import * as React from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

export interface StaffHelpModalProps {
  isOpen: boolean
  onClose: () => void
  tableNumber?: string | null
}

export function StaffHelpModal({ isOpen, onClose, tableNumber }: StaffHelpModalProps) {
  const { showToast } = useToast()
  const [callingWaiter, setCallingWaiter] = React.useState(false)

  const handleCallWaiter = () => {
    setCallingWaiter(true)
    setTimeout(() => {
      setCallingWaiter(false)
      showToast(
        tableNumber
          ? `Pelayan telah diberitahu untuk mendatangi Meja ${tableNumber}.`
          : 'Pelayan telah diberitahu untuk mendatangi meja Anda.',
        'success'
      )
      onClose()
    }, 800)
  }

  // Official cafe contacts (SELA Artisanal Coffee & Bake)
  const officialWaNumber = '6281234567890'
  const waMessage = encodeURIComponent(
    tableNumber
      ? `Halo SELA Coffee, saya pelanggan di Meja ${tableNumber} membutuhkan bantuan pesanan.`
      : 'Halo SELA Coffee, saya pelanggan membutuhkan bantuan pesanan.'
  )
  const waUrl = `https://wa.me/${officialWaNumber}?text=${waMessage}`

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Bantuan Staf & Layanan Meja"
      description={
        tableNumber
          ? `Pelayanan aktif untuk Meja ${tableNumber} — SELA Artisanal Coffee & Bake`
          : 'Pelayanan aktif — SELA Artisanal Coffee & Bake'
      }
    >
      <div className="space-y-4 pt-2">
        {/* Option 1: Panggil Pelayan ke Meja */}
        <div className="rounded-lg border border-outline-variant bg-surface-low p-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-sm font-semibold text-on-surface">Panggil Pelayan ke Meja</h4>
              <p className="mt-0.5 text-xs text-on-surface-variant">
                Staf lantai kami akan segera mendatangi meja Anda untuk membantu pemesanan atau kebutuhan meja.
              </p>
            </div>
          </div>
          <div className="mt-3">
            <Button
              variant="primary"
              size="md"
              className="w-full"
              isLoading={callingWaiter}
              onClick={handleCallWaiter}
            >
              Panggil Pelayan Sekarang
            </Button>
          </div>
        </div>

        {/* Option 2: Kontak Resmi WhatsApp */}
        <div className="rounded-lg border border-outline-variant bg-surface-lowest p-4">
          <h4 className="text-sm font-semibold text-on-surface">Chat WhatsApp Resmi</h4>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            Hubungi kasir/manajer kafe via WhatsApp jika ada pertanyaan menu khusus atau alergi makanan.
          </p>
          <div className="mt-3">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-touch w-full items-center justify-center rounded-DEFAULT border border-outline-variant bg-surface-lowest px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-low active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <svg className="mr-2 h-4 w-4 text-[#25D366] fill-current" viewBox="0 0 24 24">
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 14.99 3.81 13.47 3.81 11.91C3.81 7.37 7.5 3.67 12.05 3.67Z" />
              </svg>
              Chat WhatsApp (+62 812-3456-7890)
            </a>
          </div>
        </div>

        {/* Option 3: Petunjuk Bayar Tunai & Info Fasilitas */}
        <div className="rounded-lg border border-outline-variant bg-surface-lowest p-4 text-xs text-on-surface-variant space-y-1.5">
          <p className="font-semibold text-on-surface">Petunjuk Pembayaran Tunai & Fasilitas:</p>
          <p>• Pembayaran tunai dapat dilakukan langsung di meja kasir dengan menyebutkan nomor meja.</p>
          <p>• Password WiFi Kafe: <strong className="text-on-surface font-mono">SELA-ARTISANAL</strong></p>
        </div>
      </div>
    </Dialog>
  )
}

