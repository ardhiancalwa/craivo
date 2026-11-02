import * as React from 'react'

export interface TableStatusBannerProps {
  tableNumber: string | null
  isTableValid: boolean
}

export function TableStatusBanner({ tableNumber, isTableValid }: TableStatusBannerProps) {
  if (isTableValid && tableNumber) {
    return null
  }

  return (
    <div
      role="alert"
      className="mb-4 rounded-xl border border-[#D97706]/30 bg-[#FEF3C7] p-3.5 text-xs text-[#92400E] shadow-sm select-none"
    >
      <div className="flex items-start gap-2.5">
        <svg
          className="h-4 w-4 shrink-0 text-[#D97706] mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div className="flex-1 leading-relaxed">
          <strong className="font-semibold block text-[#78350F]">
            Mode Baca Menu (Meja Belum Terdeteksi)
          </strong>
          <span>
            Anda dapat melihat seluruh sajian katalog. Untuk memesan dan melakukan checkout, silakan
            pindai stiker kode QR di meja kafe Anda.
          </span>
        </div>
      </div>
    </div>
  )
}

