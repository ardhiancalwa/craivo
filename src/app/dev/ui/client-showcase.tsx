'use client'

import * as React from 'react'
import {
  Button,
  Input,
  Textarea,
  Badge,
  Dialog,
  BottomSheet,
  RadioOption,
  CheckboxOption,
  QuantityStepper,
  SkeletonCard,
  SkeletonButton,
  SkeletonText,
  Spinner,
  ToastProvider,
  useToast,
  EmptyState,
  ErrorState,
  ConnectionBanner,
} from '@/components/ui'
import { formatIDR } from '@/lib/utils'

function ShowcaseContent() {
  const { showToast } = useToast()

  // Interactive Demo States
  const [btnLoading, setBtnLoading] = React.useState(false)
  const [stepperVal, setStepperVal] = React.useState(2)
  const [inlineStepperVal, setInlineStepperVal] = React.useState(1)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [isSheetOpen, setIsSheetOpen] = React.useState(false)
  const [radioVal, setRadioVal] = React.useState('normal')
  const [checkOatmilk, setCheckOatmilk] = React.useState(true)
  const [checkEspresso, setCheckEspresso] = React.useState(false)
  const [inputVal, setInputVal] = React.useState('')
  const [hasError, setHasError] = React.useState(false)
  const [activeViewport, setActiveViewport] = React.useState<'360px' | '390px' | '430px' | '100%'>('100%')

  const toggleLoading = () => {
    setBtnLoading(true)
    setTimeout(() => {
      setBtnLoading(false)
      showToast('Aksi berhasil diselesaikan!', 'success')
    }, 1200)
  }

  return (
    <div className="min-h-screen bg-surface p-4 md:p-8 font-sans">
      <div className="mx-auto max-w-5xl space-y-12">
        {/* Header */}
        <div className="border-b border-outline-variant pb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                SELA Minimalist Artisanal
              </span>
              <h1 className="text-3xl font-bold text-on-surface font-display">
                Galeri Komponen Fondasi UI
              </h1>
              <p className="mt-1 text-sm text-on-surface-variant">
                Showcase interaktif komponen atomik, tokens, aksesibilitas, dan breakpoint responsif.
              </p>
            </div>
            <Badge variant="cooking" size="md">
              DEV MODE ONLY (404 in Prod)
            </Badge>
          </div>

          {/* Viewport Width Switcher */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-on-surface">Simulasi Lebar:</span>
            {(['360px', '390px', '430px', '100%'] as const).map((vp) => (
              <Button
                key={vp}
                variant={activeViewport === vp ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setActiveViewport(vp)}
              >
                {vp === '100%' ? 'Layar Penuh (Responsive)' : vp}
              </Button>
            ))}
          </div>
        </div>

        {/* Viewport Frame Container */}
        <div
          style={{ maxWidth: activeViewport }}
          className="mx-auto transition-all duration-280 space-y-10"
        >
          {/* Section 1: Color Tokens & WCAG Contrast Summary */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-on-surface font-display">1. Token Warna SELA</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6 text-xs">
              <div className="rounded-lg border border-outline-variant bg-surface p-3 text-on-surface">
                <div className="h-10 w-full rounded bg-[#FBF9F5] border border-outline-variant shadow-inner" />
                <p className="mt-2 font-bold">Surface</p>
                <p className="text-on-surface-variant">#FBF9F5</p>
              </div>
              <div className="rounded-lg border border-outline-variant bg-surface-lowest p-3 text-on-surface">
                <div className="h-10 w-full rounded bg-[#FFFFFF] border border-outline-variant shadow-inner" />
                <p className="mt-2 font-bold">Lowest</p>
                <p className="text-on-surface-variant">#FFFFFF</p>
              </div>
              <div className="rounded-lg border border-outline-variant bg-surface-lowest p-3 text-on-surface">
                <div className="h-10 w-full rounded bg-[#924805]" />
                <p className="mt-2 font-bold text-primary">Primary</p>
                <p className="text-on-surface-variant">#924805</p>
              </div>
              <div className="rounded-lg border border-outline-variant bg-surface-lowest p-3 text-on-surface">
                <div className="h-10 w-full rounded bg-[#1B1C1A]" />
                <p className="mt-2 font-bold">On Surface</p>
                <p className="text-on-surface-variant">#1B1C1A</p>
              </div>
              <div className="rounded-lg border border-outline-variant bg-surface-lowest p-3 text-on-surface">
                <div className="h-10 w-full rounded bg-[#241E1B]" />
                <p className="mt-2 font-bold">Inverse Surface</p>
                <p className="text-on-surface-variant">#241E1B</p>
              </div>
              <div className="rounded-lg border border-outline-variant bg-surface-lowest p-3 text-on-surface">
                <div className="h-10 w-full rounded bg-[#E7E2DA] border border-outline" />
                <p className="mt-2 font-bold">Outline Variant</p>
                <p className="text-on-surface-variant">#E7E2DA</p>
              </div>
            </div>
          </section>

          {/* Section 2: Typography & Tabular Numerals */}
          <section className="space-y-4 rounded-xl border border-outline-variant bg-surface-lowest p-6">
            <h2 className="text-xl font-bold text-on-surface font-display">2. Tipografi & Tabular Numerals</h2>
            <div className="space-y-3">
              <p className="font-display text-2xl font-bold text-on-surface">
                Plus Jakarta Sans: Display Title 24px Bold (SELA Artisanal)
              </p>
              <p className="text-sm text-on-surface leading-relaxed">
                Inter: Body Text Regular 14px — Dirancang untuk kenyamanan membaca deskripsi rasa racikan kopi dan instruksi pemesanan tanpa membuat mata lelah.
              </p>
              <div className="rounded-lg bg-surface-low p-4 space-y-1">
                <p className="text-xs font-semibold uppercase text-on-surface-variant">Uji Kesejajaran Angka Tabular (Tabular Nums):</p>
                <p className="font-mono text-sm tabular-nums font-semibold text-primary font-price-tabular">
                  11 x {formatIDR(28000)} = {formatIDR(308000)}
                </p>
                <p className="font-mono text-sm tabular-nums font-semibold text-primary font-price-tabular">
                  09 x {formatIDR(28000)} = {formatIDR(252000)}
                </p>
                <p className="text-xs text-on-surface-variant">
                  Digit 1, 0, 9 tetap sejajar sempurna tanpa pergeseran horizontal.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3: Buttons */}
          <section className="space-y-4 rounded-xl border border-outline-variant bg-surface-lowest p-6">
            <h2 className="text-xl font-bold text-on-surface font-display">3. Buttons & Target Sentuh</h2>
            <p className="text-xs text-on-surface-variant">
              Target sentuh minimum mobile: 44px (`min-h-touch`), KDS Dapur: 56px (`min-h-touch-kds`).
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" onClick={toggleLoading} isLoading={btnLoading}>
                Primary Action (44px)
              </Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
              <Button variant="primary" disabled>Disabled</Button>
            </div>
            <div className="pt-2">
              <p className="mb-2 text-xs font-semibold text-on-surface">Tombol KDS Dapur (Jumbo 56px):</p>
              <Button variant="kds" size="kds" className="w-full sm:w-auto">
                Mulai Dibuat (56px KDS)
              </Button>
            </div>
          </section>

          {/* Section 4: Form Controls */}
          <section className="space-y-4 rounded-xl border border-outline-variant bg-surface-lowest p-6">
            <h2 className="text-xl font-bold text-on-surface font-display">4. Form Inputs & Textarea</h2>
            <div className="space-y-4">
              <Input
                label="Nama Pelanggan"
                placeholder="Contoh: Raka"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                helperText="Nama ini akan dipanggil saat pesanan siap."
              />
              <Input
                label="Nomor Meja"
                value="Meja 07"
                readOnly
                disabled
                helperText="Terkunci otomatis dari kode QR meja."
              />
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setHasError(!hasError)}
                  className="mb-2 text-xs"
                >
                  {hasError ? 'Hapus Simulasi Error' : 'Simulasikan Error Validasi'}
                </Button>
                <Input
                  label="Email / Kontak"
                  placeholder="name@example.com"
                  error={hasError ? 'Format email tidak valid atau belum terisi.' : undefined}
                />
              </div>
              <Textarea
                label="Catatan Khusus Barista"
                placeholder="Contoh: Es dipisah, jangan terlalu manis."
                maxLength={120}
                showCount
                helperText="Maksimal 120 karakter."
              />
            </div>
          </section>

          {/* Section 5: Badges & Dual Encoding */}
          <section className="space-y-4 rounded-xl border border-outline-variant bg-surface-lowest p-6">
            <h2 className="text-xl font-bold text-on-surface font-display">5. Badges & Dual-Encoding</h2>
            <p className="text-xs text-on-surface-variant">
              Memenuhi WCAG 2.1 AA dengan selalu memadukan ikon spesifik + label teks.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="table">Meja 07</Badge>
              <Badge variant="primary">Favorit</Badge>
              <Badge
                variant="paid"
                icon={
                  <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                }
              >
                Lunas (PAID)
              </Badge>
              <Badge
                variant="cooking"
                icon={
                  <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                }
              >
                Sedang Dibuat
              </Badge>
              <Badge
                variant="error"
                icon={
                  <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                }
              >
                Batal / Expired
              </Badge>
              <Badge variant="soldout">Habis</Badge>
            </div>
          </section>

          {/* Section 6: Radio & Checkbox (Modifiers) */}
          <section className="space-y-4 rounded-xl border border-outline-variant bg-surface-lowest p-6">
            <h2 className="text-xl font-bold text-on-surface font-display">6. Radio & Checkbox Varian Menu</h2>
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-semibold text-on-surface">Pilihan Tingkat Manis (Single Choice):</p>
                <div className="space-y-2">
                  <RadioOption
                    name="sweetness"
                    label="Normal Sweet (100%)"
                    description="Standar racikan barista SELA"
                    checked={radioVal === 'normal'}
                    onChange={() => setRadioVal('normal')}
                  />
                  <RadioOption
                    name="sweetness"
                    label="Less Sweet (50%)"
                    description="Rasa manis lembut"
                    checked={radioVal === 'less'}
                    onChange={() => setRadioVal('less')}
                  />
                  <RadioOption
                    name="sweetness"
                    label="No Sugar (0%)"
                    description="Tanpa pemanis aren"
                    checked={radioVal === 'none'}
                    onChange={() => setRadioVal('none')}
                  />
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-on-surface">Tambahan Bebas (Add-ons):</p>
                <div className="space-y-2">
                  <CheckboxOption
                    label="Ganti Susu Oatmilk"
                    description="Rasa lebih creamy & bebas laktosa"
                    priceDelta={6000}
                    checked={checkOatmilk}
                    onChange={(e) => setCheckOatmilk(e.target.checked)}
                  />
                  <CheckboxOption
                    label="Ekstra Single Shot Espresso"
                    description="Kopi arabika ganda lebih mantap"
                    priceDelta={5000}
                    checked={checkEspresso}
                    onChange={(e) => setCheckEspresso(e.target.checked)}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Section 7: Quantity Stepper */}
          <section className="space-y-4 rounded-xl border border-outline-variant bg-surface-lowest p-6">
            <h2 className="text-xl font-bold text-on-surface font-display">7. Quantity Stepper</h2>
            <div className="flex flex-wrap items-center gap-8">
              <div>
                <p className="mb-2 text-xs font-semibold text-on-surface">Varian Drawer / Keranjang (44px):</p>
                <QuantityStepper value={stepperVal} onChange={setStepperVal} min={1} />
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold text-on-surface">Varian Inline Kartu Menu (Dark Capsule):</p>
                <QuantityStepper
                  value={inlineStepperVal}
                  onChange={setInlineStepperVal}
                  min={0}
                  variant="inline"
                />
              </div>
            </div>
          </section>

          {/* Section 8: Dialog & BottomSheet */}
          <section className="space-y-4 rounded-xl border border-outline-variant bg-surface-lowest p-6">
            <h2 className="text-xl font-bold text-on-surface font-display">8. Dialog & Bottom Sheet (A11y Verified)</h2>
            <p className="text-xs text-on-surface-variant">
              Mendukung scroll lock, Escape key, focus trapping, dan pemulihan fokus otomatis saat ditutup.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Button variant="outline" onClick={() => setIsDialogOpen(true)}>
                Buka Dialog Modal (Desktop/Tablet)
              </Button>
              <Button variant="primary" onClick={() => setIsSheetOpen(true)}>
                Buka Bottom Sheet (Mobile Drawer)
              </Button>
            </div>
          </section>

          {/* Section 9: Skeletons & Spinner */}
          <section className="space-y-4 rounded-xl border border-outline-variant bg-surface-lowest p-6">
            <h2 className="text-xl font-bold text-on-surface font-display">9. Loading States & Shimmer Skeletons</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <SkeletonCard />
              <div className="space-y-3">
                <SkeletonText lines={4} />
                <SkeletonButton />
              </div>
              <div className="flex flex-col items-center justify-center p-6 border border-outline-variant rounded-md">
                <Spinner size="lg" />
                <span className="mt-2 text-xs text-on-surface-variant">Memuat data...</span>
              </div>
            </div>
          </section>

          {/* Section 10: Toast Triggers */}
          <section className="space-y-4 rounded-xl border border-outline-variant bg-surface-lowest p-6">
            <h2 className="text-xl font-bold text-on-surface font-display">10. Toast Feedback</h2>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => showToast('Pesanan berhasil ditambahkan ke keranjang!', 'success')}
              >
                Toast Sukses
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => showToast('Koneksi internet lambat.', 'warning')}
              >
                Toast Peringatan
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => showToast('Stok menu baru saja habis.', 'error')}
              >
                Toast Error
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => showToast('Meja 07 aktif.', 'info')}
              >
                Toast Info
              </Button>
            </div>
          </section>

          {/* Section 11: Empty & Error States */}
          <section className="space-y-4 rounded-xl border border-outline-variant bg-surface-lowest p-6">
            <h2 className="text-xl font-bold text-on-surface font-display">11. Empty & Error States</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <EmptyState
                title="Keranjang Masih Kosong"
                description="Jelajahi pilihan menu artisan SELA atau ikuti kurasi 30 detik untuk rekomendasi rasa."
                actionLabel="Jelajahi Menu"
                onAction={() => showToast('Membuka katalog menu...', 'info')}
              />
              <ErrorState
                title="Gagal Memuat Menu"
                message="Terjadi kendala saat menghubungkan ke server. Silakan muat ulang halaman."
                retryLabel="Coba Lagi"
                onRetry={() => showToast('Mencoba menghubungkan kembali...', 'info')}
              />
            </div>
          </section>
        </div>
      </div>

      {/* Modal Instances */}
      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title="Konfirmasi Pembayaran Kasir"
        description="Pastikan nominal uang tunai yang diterima telah sesuai dengan total tagihan pesanan."
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-surface-low p-3 text-sm">
            <div className="flex justify-between">
              <span>Nomor Meja:</span>
              <strong className="text-on-surface">Meja 07</strong>
            </div>
            <div className="flex justify-between mt-1">
              <span>Total Tagihan:</span>
              <strong className="text-primary tabular-nums font-price-tabular">{formatIDR(56000)}</strong>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>
              Batal
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setIsDialogOpen(false)
                showToast('Pembayaran tunai berhasil dikonfirmasi!', 'success')
              }}
            >
              Konfirmasi Uang Masuk
            </Button>
          </div>
        </div>
      </Dialog>

      <BottomSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        title="Kopi Susu Aren SELA"
        description="Espresso arabika ganda dipadukan dengan gula aren organik dan susu segar."
      >
        <div className="space-y-4">
          <div className="rounded-DEFAULT bg-surface-low p-3 flex justify-between items-center">
            <span className="text-sm font-medium">Harga Satuan:</span>
            <span className="text-base font-bold text-primary font-price-tabular tabular-nums">
              {formatIDR(28000)}
            </span>
          </div>
          <RadioOption
            name="demo-sheet-radio"
            label="Normal Ice & Sweet"
            checked={true}
            readOnly
          />
          <div className="pt-2">
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => {
                setIsSheetOpen(false)
                showToast('Item berhasil ditambahkan ke pesanan!', 'success')
              }}
            >
              Tambah ke Pesanan — {formatIDR(28000)}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}

export default function DevUiClientShowcase() {
  return (
    <ToastProvider>
      <ConnectionBanner />
      <ShowcaseContent />
    </ToastProvider>
  )
}
