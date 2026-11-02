'use client'

import * as React from 'react'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { RadioOption } from '@/components/ui/radio'
import { CheckboxOption } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { formatIDR } from '@/lib/utils'
import { useCart, type SelectedModifier, type CartItem } from '@/lib/cart-context'
import { useToast } from '@/components/ui/toast'
import type { CatalogMenuItem } from '@/lib/server/menu-service'

export interface ProductModifierSheetProps {
  item: CatalogMenuItem | null
  isOpen: boolean
  onClose: () => void
  editingCartItem?: CartItem | null
}

export function ProductModifierSheet({
  item,
  isOpen,
  onClose,
  editingCartItem,
}: ProductModifierSheetProps) {
  const { addItem, updateItemDetails } = useCart()
  const { showToast } = useToast()

  // State: Record of group ID to selected option ID (for single choice)
  const [singleChoiceSelections, setSingleChoiceSelections] = React.useState<
    Record<string, string>
  >({})
  // State: Set of selected option IDs (for multi choice)
  const [multiChoiceSelections, setMultiChoiceSelections] = React.useState<
    Record<string, boolean>
  >({})
  const [notes, setNotes] = React.useState('')

  // Initialize selections whenever item opens or changes
  React.useEffect(() => {
    if (!item) return

    const initialSingle: Record<string, string> = {}
    const initialMulti: Record<string, boolean> = {}

    if (editingCartItem) {
      // Pre-fill selections from editingCartItem
      editingCartItem.selectedModifiers.forEach((mod) => {
        const group = item.modifierGroups.find((g) => g.id === mod.groupId)
        if (group && group.maxSelect === 1) {
          initialSingle[group.id] = mod.optionId
        } else {
          initialMulti[mod.optionId] = true
        }
      })
      setNotes(editingCartItem.notes || '')
    } else {
      // Default to first option for required single-choice groups
      item.modifierGroups.forEach((group) => {
        if (group.maxSelect === 1 && group.isRequired) {
          const firstOpt = group.options[0]
          if (firstOpt) {
            initialSingle[group.id] = firstOpt.id
          }
        }
      })
      setNotes('')
    }

    setSingleChoiceSelections(initialSingle)
    setMultiChoiceSelections(initialMulti)
  }, [item, isOpen, editingCartItem])

  if (!item) return null

  // Calculate current subtotal and build selected modifiers list
  let modifierTotal = 0
  const selectedModifiersList: SelectedModifier[] = []

  item.modifierGroups.forEach((group) => {
    if (group.maxSelect === 1) {
      const selectedOptId = singleChoiceSelections[group.id]
      const option = group.options.find((o) => o.id === selectedOptId)
      if (option) {
        modifierTotal += option.price
        selectedModifiersList.push({
          optionId: option.id,
          groupId: group.id,
          groupName: group.name,
          optionName: option.name,
          price: option.price,
        })
      }
    } else {
      group.options.forEach((opt) => {
        if (multiChoiceSelections[opt.id]) {
          modifierTotal += opt.price
          selectedModifiersList.push({
            optionId: opt.id,
            groupId: group.id,
            groupName: group.name,
            optionName: opt.name,
            price: opt.price,
          })
        }
      })
    }
  })

  // Validate required groups and selection constraints
  const isFormValid = item.modifierGroups.every((group) => {
    if (group.maxSelect === 1) {
      if (group.isRequired) {
        return Boolean(singleChoiceSelections[group.id])
      }
      return true
    } else {
      const selectedCount = group.options.filter((o) => multiChoiceSelections[o.id]).length
      if (group.isRequired && selectedCount < group.minSelect) {
        return false
      }
      if (selectedCount > group.maxSelect) {
        return false
      }
      return true
    }
  })

  const currentPrice = item.price + modifierTotal

  const handleSave = () => {
    if (!isFormValid) {
      showToast('Mohon lengkapi pilihan wajib sebelum melanjutkan.', 'error')
      return
    }

    if (editingCartItem) {
      updateItemDetails(
        editingCartItem.cartItemId,
        selectedModifiersList,
        notes.trim() || undefined
      )
      showToast(`Perubahan racikan ${item.name} berhasil disimpan!`, 'success')
      onClose()
    } else {
      const success = addItem(
        item,
        selectedModifiersList,
        notes.trim() || undefined,
        1
      )
      if (success) {
        showToast(`${item.name} berhasil ditambahkan ke keranjang!`, 'success')
        onClose()
      } else {
        showToast('Menu ini sedang habis dan tidak dapat dipesan.', 'error')
      }
    }
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={editingCartItem ? `Ubah Racikan: ${item.name}` : item.name}
      description={item.description}
    >
      <div className="space-y-6 pt-2 pb-8">
        {/* Base Price Pill */}
        <div className="flex items-center justify-between rounded-lg bg-surface-low p-3">
          <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            Harga Dasar
          </span>
          <span className="text-base font-bold tabular-nums text-primary font-price-tabular">
            {formatIDR(item.price)}
          </span>
        </div>

        {/* Modifier Groups */}
        {item.modifierGroups.map((group) => {
          const isSingleChoice = group.maxSelect === 1
          const selectedCount = isSingleChoice
            ? singleChoiceSelections[group.id] ? 1 : 0
            : group.options.filter((o) => multiChoiceSelections[o.id]).length

          const isGroupFulfilled = group.isRequired
            ? selectedCount >= group.minSelect && selectedCount <= group.maxSelect
            : true

          return (
            <div key={group.id} className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-on-surface flex items-center gap-1.5">
                  <span>{group.name}</span>
                  {group.isRequired ? (
                    <span className="text-xs font-bold text-primary">* (Wajib)</span>
                  ) : (
                    <span className="text-[11px] text-on-surface-variant font-normal">
                      (Opsional)
                    </span>
                  )}
                </h4>
                <span
                  className={`text-[11px] font-medium ${
                    !isGroupFulfilled ? 'text-error' : 'text-on-surface-variant'
                  }`}
                >
                  {isSingleChoice
                    ? 'Pilih 1'
                    : `Pilih maks. ${group.maxSelect}`}
                </span>
              </div>

              <div className="space-y-2">
                {group.options.map((opt) => {
                  if (isSingleChoice) {
                    const isChecked = singleChoiceSelections[group.id] === opt.id
                    return (
                      <RadioOption
                        key={opt.id}
                        name={`mod-group-${group.id}`}
                        label={opt.name}
                        priceDelta={opt.price}
                        checked={isChecked}
                        onChange={() => {
                          setSingleChoiceSelections((prev) => ({
                            ...prev,
                            [group.id]: opt.id,
                          }))
                        }}
                      />
                    )
                  } else {
                    const isChecked = Boolean(multiChoiceSelections[opt.id])
                    return (
                      <CheckboxOption
                        key={opt.id}
                        label={opt.name}
                        priceDelta={opt.price}
                        checked={isChecked}
                        onChange={(e) => {
                          const willCheck = e.target.checked
                          if (willCheck && selectedCount >= group.maxSelect) {
                            showToast(
                              `Maksimal ${group.maxSelect} opsi untuk ${group.name}.`,
                              'error'
                            )
                            return
                          }
                          setMultiChoiceSelections((prev) => ({
                            ...prev,
                            [opt.id]: willCheck,
                          }))
                        }}
                      />
                    )
                  }
                })}
              </div>
            </div>
          )
        })}

        {/* Notes Textarea */}
        <div className="pt-1">
          <Textarea
            label="Catatan Khusus Barista"
            placeholder="Contoh: Es dipisah, jangan terlalu manis"
            maxLength={100}
            showCount
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            helperText="Maksimal 100 karakter. Alergi makanan mohon konfirmasi langsung ke staf."
          />
        </div>

        {/* Sticky Submit Button */}
        <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 border-t border-outline-variant bg-surface-lowest/95 backdrop-blur-md p-4 pb-safe z-20 shadow-level2">
          <Button
            variant="primary"
            size="lg"
            disabled={!isFormValid}
            className="w-full font-bold shadow-md rounded-xl active:scale-[0.98]"
            onClick={handleSave}
          >
            {editingCartItem ? 'Simpan Perubahan' : 'Tambah ke Pesanan'} —{' '}
            {formatIDR(currentPrice)}
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}
