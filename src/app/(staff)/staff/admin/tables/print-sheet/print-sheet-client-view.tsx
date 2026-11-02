'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowLeft, Printer, Download, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { Table } from '@prisma/client'

interface PrintSheetClientViewProps {
  tables: Table[]
  cafeName: string
  stagingBaseUrl: string
  productionDomain: string | null
  isProductionReady: boolean
}

export function PrintSheetClientView({
  tables,
  cafeName,
  stagingBaseUrl,
  productionDomain,
  isProductionReady,
}: PrintSheetClientViewProps) {
  const [targetEnv, setTargetEnv] = React.useState<'staging' | 'production'>('staging')

  const activeBaseUrl =
    targetEnv === 'production' && isProductionReady && productionDomain
      ? productionDomain.replace(/\/+$/, '')
      : stagingBaseUrl

  // Bagi meja ke dalam halaman A4 (4 kartu per lembar)
  const CARDS_PER_SHEET = 4
  const sheets: Table[][] = []
  for (let i = 0; i < tables.length; i += CARDS_PER_SHEET) {
    sheets.push(tables.slice(i, i + CARDS_PER_SHEET))
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="min-h-screen bg-stone-100 print:bg-white text-stone-900">
      {/* Top Navigation & Toolbar (Tersembunyi saat dicetak) */}
      <header className="print:hidden sticky top-0 z-30 bg-white border-b border-stone-200 px-4 py-3 shadow-sm">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/staff/admin"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali ke Admin
            </Link>
            <div>
              <h1 className="text-base font-bold text-stone-900">Lembar Cetak QR Meja A4</h1>
              <p className="text-xs text-stone-500">
                {tables.length} meja aktif • {sheets.length} lembar A4 siap potong
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Environment Selector */}
            <div className="flex items-center bg-stone-100 p-1 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setTargetEnv('staging')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  targetEnv === 'staging'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Staging / Preview
              </button>
              <button
                type="button"
                onClick={() => setTargetEnv('production')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  targetEnv === 'production'
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Master Produksi
              </button>
            </div>

            {/* Direct PDF Download */}
            <a
              href={`/api/staff/admin/tables/export/pdf?env=${targetEnv}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Unduh PDF Langsung
            </a>

            {/* Print Trigger */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={targetEnv === 'production' && !isProductionReady}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-amber-800 hover:bg-amber-900 disabled:bg-stone-300 disabled:cursor-not-allowed rounded-lg shadow transition-colors"
            >
              <Printer className="w-4 h-4" />
              Cetak / Simpan PDF
            </button>
          </div>
        </div>

        {/* Warning Banner if Production Blocked */}
        {targetEnv === 'production' && !isProductionReady && (
          <div className="max-w-6xl mx-auto mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-800">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Master Cetak Produksi Diblokir: </span>
              Domain produksi permanen belum dikonfigurasi di Pengaturan Kafe. Untuk mencegah kerugian biaya cetak fisik akrilik dengan URL sementara, silakan konfigurasi domain di tab Pengaturan Kafe atau gunakan mode Staging.
            </div>
          </div>
        )}

        {targetEnv === 'staging' && (
          <div className="max-w-6xl mx-auto mt-2 text-[11px] text-amber-800 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
            <span>Mode Staging aktif. URL yang dicetak mengarah ke: <code>{stagingBaseUrl}/order?table=XX</code> (Watermark STAGING disertakan).</span>
          </div>
        )}
      </header>

      {/* Printable Sheet View */}
      <main className="p-4 print:p-0 max-w-5xl mx-auto">
        <style dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: A4 portrait;
                margin: 8mm;
              }
              body {
                background: white !important;
                color: black !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .sheet-page {
                page-break-after: always;
                break-after: page;
                margin: 0 !important;
                padding: 0 !important;
                box-shadow: none !important;
                border: none !important;
                height: 100vh !important;
              }
              .sheet-page:last-child {
                page-break-after: avoid;
                break-after: avoid;
              }
            }
          `
        }} />

        {sheets.map((sheetTables, sheetIdx) => (
          <div
            key={sheetIdx}
            className="sheet-page bg-white mx-auto my-6 print:my-0 shadow-lg print:shadow-none border border-stone-200 print:border-none rounded-xl print:rounded-none p-6 print:p-2"
            style={{ width: '210mm', minHeight: '297mm' }}
          >
            {/* Sheet Sub-Header info (Printable small note) */}
            <div className="flex justify-between items-center text-[10px] text-stone-400 border-b border-stone-100 pb-2 mb-4">
              <span>{cafeName} — Lembar Cetak QR Meja A4</span>
              <span>
                {targetEnv === 'production' ? 'MASTER PRODUKSI' : 'STAGING / PREVIEW'} • Lembar {sheetIdx + 1} dari {sheets.length}
              </span>
            </div>

            {/* Grid 2 Kolom x 2 Baris = 4 Kartu Meja */}
            <div className="grid grid-cols-2 gap-6 print:gap-4">
              {sheetTables.map((table) => (
                <div
                  key={table.id}
                  className="relative border border-stone-300 rounded-xl p-5 flex flex-col items-center justify-between text-center bg-white"
                  style={{ height: '128mm' }}
                >
                  {/* Crop mark corners */}
                  <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t border-l border-stone-400" />
                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t border-r border-stone-400" />
                  <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b border-l border-stone-400" />
                  <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b border-r border-stone-400" />

                  {/* Header Kartu */}
                  <div>
                    <h2 className="text-xl font-black tracking-wider text-stone-900 uppercase">
                      SELA
                    </h2>
                    <p className="text-[10px] italic text-stone-500 font-sans -mt-0.5">
                      Artisanal Coffee & Bake
                    </p>
                    <div className="w-16 h-0.5 bg-stone-200 mx-auto mt-2" />
                  </div>

                  {/* Nomor Meja & Label */}
                  <div className="my-1">
                    <span className="text-3xl font-black text-stone-900 tracking-tight block">
                      MEJA {table.tableNumber}
                    </span>
                    {table.label && table.label !== `Meja ${table.tableNumber}` && (
                      <span className="text-xs text-stone-500 font-medium block mt-0.5">
                        {table.label}
                      </span>
                    )}
                  </div>

                  {/* QR Code Container (Crisp SVG Image) */}
                  <div className="p-2 bg-white rounded-lg border border-stone-100 shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/staff/admin/tables/${table.id}/qr?format=svg&env=${targetEnv}`}
                      alt={`QR Code Meja ${table.tableNumber}`}
                      className="w-44 h-44 object-contain"
                    />
                  </div>

                  {/* Footer Instruksi */}
                  <div className="w-full">
                    <p className="text-xs font-bold text-stone-800 tracking-wide uppercase">
                      PINDAI UNTUK MEMESAN
                    </p>
                    <p className="text-[9px] text-stone-500 mt-0.5">
                      Buka kamera ponsel Anda lalu arahkan ke kode QR
                    </p>
                    <p className="text-[8px] text-stone-400 font-mono mt-1 truncate max-w-full px-2">
                      {activeBaseUrl}/order?table={table.tableNumber}
                    </p>

                    {targetEnv === 'staging' && (
                      <span className="inline-block mt-1 text-[8px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 uppercase">
                        STAGING / PREVIEW
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}

