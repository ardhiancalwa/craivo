'use client'

import * as React from 'react'

export interface SelectedModifier {
  optionId: string
  groupId: string
  groupName: string
  optionName: string
  price: number // Integer IDR (e.g. 0, 8000)
}

export interface CartItem {
  cartItemId: string // `${menuItemId}:${sortedOptionIds.join('-')}:${notes.trim()}`
  menuItemId: string
  name: string
  basePrice: number // Integer IDR
  selectedModifiers: SelectedModifier[]
  notes?: string
  quantity: number
  unitPrice: number // basePrice + modifiers price
  itemSubtotal: number // unitPrice * quantity
}

export interface OrderQuoteDTO {
  quoteId: string
  quoteToken: string
  tableNumber: string
  subtotalAmount: number
  taxAmount: number
  serviceAmount: number
  totalAmount: number
  expiresAt: string
  financialBreakdown?: {
    isTaxInclusive: boolean
    taxRateBps: number
    serviceRateBps: number
    taxPercentageFormatted: string
    servicePercentageFormatted: string
    netBaseAmount: number
  }
}

interface CartContextType {
  items: CartItem[]
  totalItems: number
  subtotal: number
  tableNumber: string | null
  isTableValid: boolean
  activeQuote: OrderQuoteDTO | null
  setTableNumber: (table: string | null) => void
  setIsTableValid: (valid: boolean) => void
  addItem: (
    menuItem: { id: string; name: string; price: number; isAvailable: boolean },
    selectedModifiers?: SelectedModifier[],
    notes?: string,
    quantity?: number
  ) => boolean
  updateQuantity: (cartItemId: string, quantity: number) => void
  updateItemDetails: (
    oldCartItemId: string,
    newModifiers: SelectedModifier[],
    newNotes?: string
  ) => void
  removeItem: (cartItemId: string) => void
  decreaseItem: (menuItemId: string) => void
  clearCart: () => void
  getItemQuantity: (menuItemId: string) => number
  setActiveQuote: (quote: OrderQuoteDTO | null) => void
  invalidateQuote: () => void
}

const CartContext = React.createContext<CartContextType | undefined>(undefined)

export function generateCartItemId(
  menuItemId: string,
  modifiers: SelectedModifier[] = [],
  notes: string = ''
): string {
  const sortedOptionIds = modifiers
    .map((m) => m.optionId)
    .sort()
    .join('-')
  const cleanNotes = (notes || '').trim()
  return cleanNotes
    ? `${menuItemId}:${sortedOptionIds}:${cleanNotes}`
    : `${menuItemId}:${sortedOptionIds}`
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<CartItem[]>([])
  const [tableNumber, setTableNumberState] = React.useState<string | null>(null)
  const [isTableValid, setIsTableValidState] = React.useState<boolean>(false)
  const [activeQuote, setActiveQuoteState] = React.useState<OrderQuoteDTO | null>(null)
  const [isHydrated, setIsHydrated] = React.useState(false)

  // Invalidate current quote whenever cart contents or table change
  const invalidateQuote = React.useCallback(() => {
    setActiveQuoteState(null)
  }, [])

  const setActiveQuote = React.useCallback((quote: OrderQuoteDTO | null) => {
    setActiveQuoteState(quote)
  }, [])

  // Load from localStorage on client mount
  React.useEffect(() => {
    try {
      const storedItems = localStorage.getItem('cravio_cart_items')
      if (storedItems) {
        setItems(JSON.parse(storedItems))
      }
      const storedTable = localStorage.getItem('cravio_cart_table')
      if (storedTable) {
        setTableNumberState(storedTable)
        setIsTableValidState(true)
      }
    } catch {
      // Ignore storage errors in private browsing
    } finally {
      setIsHydrated(true)
    }
  }, [])

  // Persist to localStorage
  React.useEffect(() => {
    if (!isHydrated) return
    try {
      localStorage.setItem('cravio_cart_items', JSON.stringify(items))
    } catch {
      // Ignore storage errors
    }
  }, [items, isHydrated])

  const setTableNumber = React.useCallback(
    (table: string | null) => {
      setTableNumberState(table)
      invalidateQuote()
      if (table) {
        try {
          localStorage.setItem('cravio_cart_table', table)
        } catch {
          // Ignore
        }
      } else {
        try {
          localStorage.removeItem('cravio_cart_table')
        } catch {
          // Ignore
        }
      }
    },
    [invalidateQuote]
  )

  const setIsTableValid = React.useCallback((valid: boolean) => {
    setIsTableValidState(valid)
  }, [])

  const addItem = React.useCallback(
    (
      menuItem: { id: string; name: string; price: number; isAvailable: boolean },
      selectedModifiers: SelectedModifier[] = [],
      notes?: string,
      quantity = 1
    ): boolean => {
      // Stock guard: cannot add sold out items to cart
      if (!menuItem.isAvailable) {
        return false
      }

      const validQty = Math.min(50, Math.max(1, quantity))
      const safeNotes = notes ? notes.slice(0, 100).trim() : undefined
      const cartItemId = generateCartItemId(menuItem.id, selectedModifiers, safeNotes)
      const modifierSum = selectedModifiers.reduce((acc, m) => acc + m.price, 0)
      const unitPrice = menuItem.price + modifierSum

      setItems((prevItems) => {
        const existingIndex = prevItems.findIndex((it) => it.cartItemId === cartItemId)
        if (existingIndex > -1) {
          const updated = [...prevItems]
          const existing = updated[existingIndex]
          if (existing) {
            const newQty = Math.min(50, existing.quantity + validQty)
            updated[existingIndex] = {
              ...existing,
              quantity: newQty,
              itemSubtotal: existing.unitPrice * newQty,
              notes: safeNotes || existing.notes,
            }
          }
          return updated
        }

        const newItem: CartItem = {
          cartItemId,
          menuItemId: menuItem.id,
          name: menuItem.name,
          basePrice: menuItem.price,
          selectedModifiers,
          notes: safeNotes,
          quantity: validQty,
          unitPrice,
          itemSubtotal: unitPrice * validQty,
        }

        return [...prevItems, newItem]
      })

      invalidateQuote()
      return true
    },
    [invalidateQuote]
  )

  const updateQuantity = React.useCallback(
    (cartItemId: string, quantity: number) => {
      setItems((prevItems) => {
        if (quantity <= 0) {
          return prevItems.filter((it) => it.cartItemId !== cartItemId)
        }
        const validQty = Math.min(50, Math.max(1, quantity))
        return prevItems.map((it) => {
          if (it.cartItemId === cartItemId) {
            return {
              ...it,
              quantity: validQty,
              itemSubtotal: it.unitPrice * validQty,
            }
          }
          return it
        })
      })
      invalidateQuote()
    },
    [invalidateQuote]
  )

  const updateItemDetails = React.useCallback(
    (
      oldCartItemId: string,
      newModifiers: SelectedModifier[],
      newNotes?: string
    ) => {
      setItems((prevItems) => {
        const existingIndex = prevItems.findIndex((it) => it.cartItemId === oldCartItemId)
        if (existingIndex === -1) return prevItems

        const oldItem = prevItems[existingIndex]
        if (!oldItem) return prevItems

        const safeNotes = newNotes ? newNotes.slice(0, 100).trim() : undefined
        const newCartItemId = generateCartItemId(oldItem.menuItemId, newModifiers, safeNotes)
        const modifierSum = newModifiers.reduce((acc, m) => acc + m.price, 0)
        const unitPrice = oldItem.basePrice + modifierSum

        // If the new ID already exists in another row, merge them
        const collisionIndex = prevItems.findIndex(
          (it, idx) => it.cartItemId === newCartItemId && idx !== existingIndex
        )

        if (collisionIndex > -1) {
          const updated = [...prevItems]
          const collisionItem = updated[collisionIndex]
          if (collisionItem) {
            const mergedQty = Math.min(50, collisionItem.quantity + oldItem.quantity)
            updated[collisionIndex] = {
              ...collisionItem,
              quantity: mergedQty,
              itemSubtotal: collisionItem.unitPrice * mergedQty,
            }
          }
          // Remove oldItem
          return updated.filter((_, idx) => idx !== existingIndex)
        }

        // Otherwise replace old item in-place
        const updated = [...prevItems]
        updated[existingIndex] = {
          ...oldItem,
          cartItemId: newCartItemId,
          selectedModifiers: newModifiers,
          notes: safeNotes,
          unitPrice,
          itemSubtotal: unitPrice * oldItem.quantity,
        }
        return updated
      })

      invalidateQuote()
    },
    [invalidateQuote]
  )

  const removeItem = React.useCallback(
    (cartItemId: string) => {
      setItems((prev) => prev.filter((it) => it.cartItemId !== cartItemId))
      invalidateQuote()
    },
    [invalidateQuote]
  )

  const clearCart = React.useCallback(() => {
    setItems([])
    invalidateQuote()
  }, [invalidateQuote])

  const decreaseItem = React.useCallback(
    (menuItemId: string) => {
      setItems((prevItems) => {
        const existingIndex = prevItems.findIndex((it) => it.menuItemId === menuItemId)
        if (existingIndex === -1) return prevItems

        const existing = prevItems[existingIndex]
        if (!existing) return prevItems

        if (existing.quantity <= 1) {
          return prevItems.filter((_, idx) => idx !== existingIndex)
        }

        const updated = [...prevItems]
        const newQty = existing.quantity - 1
        updated[existingIndex] = {
          ...existing,
          quantity: newQty,
          itemSubtotal: existing.unitPrice * newQty,
        }
        return updated
      })
      invalidateQuote()
    },
    [invalidateQuote]
  )

  // Helper to get total quantity of a base menu item across all variations
  const getItemQuantity = React.useCallback(
    (menuItemId: string) => {
      return items
        .filter((it) => it.menuItemId === menuItemId)
        .reduce((sum, it) => sum + it.quantity, 0)
    },
    [items]
  )

  const totalItems = React.useMemo(() => {
    return items.reduce((acc, it) => acc + it.quantity, 0)
  }, [items])

  const subtotal = React.useMemo(() => {
    return items.reduce((acc, it) => acc + it.itemSubtotal, 0)
  }, [items])

  const contextValue = React.useMemo(
    () => ({
      items,
      totalItems,
      subtotal,
      tableNumber,
      isTableValid,
      activeQuote,
      setTableNumber,
      setIsTableValid,
      addItem,
      updateQuantity,
      updateItemDetails,
      removeItem,
      decreaseItem,
      clearCart,
      getItemQuantity,
      setActiveQuote,
      invalidateQuote,
    }),
    [
      items,
      totalItems,
      subtotal,
      tableNumber,
      isTableValid,
      activeQuote,
      setTableNumber,
      setIsTableValid,
      addItem,
      updateQuantity,
      updateItemDetails,
      removeItem,
      decreaseItem,
      clearCart,
      getItemQuantity,
      setActiveQuote,
      invalidateQuote,
    ]
  )

  return <CartContext.Provider value={contextValue}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = React.useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}
