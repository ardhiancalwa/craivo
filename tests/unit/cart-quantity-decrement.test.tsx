import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react'
import { CartProvider, useCart } from '@/lib/cart-context'
import { MenuCard } from '@/components/menu/menu-card'
import type { CatalogMenuItem } from '@/lib/server/menu-service'

const mockItemWithoutModifiers: CatalogMenuItem = {
  id: 'menu-espresso-01',
  name: 'Espresso Single',
  description: 'Single shot espresso arabika murni',
  price: 18000,
  image: '/images/espresso.webp',
  categoryId: 'cat-kopi',
  categoryName: 'Kopi',
  categorySlug: 'kopi',
  isAvailable: true,
  isPopular: false,
  soldCount: 45,
  tags: [],
  modifierGroups: [],
}

describe('Cart Quantity Decrement & Stepper Integration', () => {
  it('decreases item quantity and updates totalItems & subtotal in CartContext', () => {
    const { result } = renderHook(() => useCart(), {
      wrapper: ({ children }) => <CartProvider>{children}</CartProvider>,
    })

    // 1. Tambah item 3 kali
    act(() => {
      result.current.addItem(mockItemWithoutModifiers, [], undefined, 3)
    })

    expect(result.current.totalItems).toBe(3)
    expect(result.current.subtotal).toBe(18000 * 3)

    // 2. Kurangi kuantitas menjadi 2 via updateQuantity
    const cartItemId = result.current.items[0]?.cartItemId
    expect(cartItemId).toBeDefined()

    act(() => {
      result.current.updateQuantity(cartItemId!, 2)
    })

    expect(result.current.totalItems).toBe(2)
    expect(result.current.subtotal).toBe(18000 * 2)

    // 3. Kurangi kuantitas via decreaseItem
    act(() => {
      result.current.decreaseItem(mockItemWithoutModifiers.id)
    })

    expect(result.current.totalItems).toBe(1)
    expect(result.current.subtotal).toBe(18000)

    // 4. Kurangi kuantitas hingga 0 (otomatis terhapus dari keranjang)
    act(() => {
      result.current.decreaseItem(mockItemWithoutModifiers.id)
    })

    expect(result.current.totalItems).toBe(0)
    expect(result.current.subtotal).toBe(0)
    expect(result.current.items.length).toBe(0)
  })

  it('renders inline stepper on MenuCard and decreases quantity synchronously on minus click', () => {
    const handleOpenModifier = () => {}

    render(
      <CartProvider>
        <MenuCard item={mockItemWithoutModifiers} onOpenModifier={handleOpenModifier} />
      </CartProvider>
    )

    // Initial state: tombol tambah '+'
    const addBtn = screen.getByRole('button', { name: /tambah espresso single ke keranjang/i })
    expect(addBtn).toBeInTheDocument()

    // Klik tambah pertama kali
    fireEvent.click(addBtn)

    // Stepper muncul dengan angka 1
    expect(screen.getByText('1')).toBeInTheDocument()

    // Klik tombol '+' pada stepper untuk menambah kuantitas ke 2
    const incrementBtn = screen.getByRole('button', { name: /tambah jumlah/i })
    fireEvent.click(incrementBtn)
    expect(screen.getByText('2')).toBeInTheDocument()

    // Klik tombol '−' pada stepper: kuantitas harus berkurang ke 1
    const decrementBtn = screen.getByRole('button', { name: /kurangi jumlah/i })
    fireEvent.click(decrementBtn)
    expect(screen.getByText('1')).toBeInTheDocument()

    // Klik tombol '−' lagi: kuantitas menjadi 0 dan stepper kembali ke tombol '+'
    fireEvent.click(decrementBtn)
    expect(
      screen.getByRole('button', { name: /tambah espresso single ke keranjang/i })
    ).toBeInTheDocument()
  })
})

