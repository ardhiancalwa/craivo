'use client'

import * as React from 'react'

export interface MenuSearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function MenuSearchBar({
  value,
  onChange,
  placeholder = 'Cari kopi, hidangan manis, atau makanan...',
}: MenuSearchBarProps) {
  return (
    <div className="relative w-full">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-on-surface-variant">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-full border border-outline-variant bg-surface-container-low py-2.5 pl-10 pr-10 text-sm text-on-surface placeholder:text-outline transition-all focus:border-primary focus:bg-surface-lowest focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-touch"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Hapus pencarian"
          className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-on-surface-variant hover:text-on-surface"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

