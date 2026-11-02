import { describe, it, expect } from 'vitest'
import { escapeHtml, generatePrintableHtml, type ReceiptOrderData } from '@/lib/receipt-formatter'

describe('Receipt XSS Guard & HTML Entity Escaping (SEC-01)', () => {
  it('correctly escapes all dangerous HTML characters', () => {
    expect(escapeHtml('<script>alert("XSS")</script>')).toBe(
      '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
    )
    expect(escapeHtml("Tom & Jerry's Café")).toBe('Tom &amp; Jerry&#039;s Café')
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'
    )
    expect(escapeHtml('')).toBe('')
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })

  const maliciousOrder: ReceiptOrderData = {
    id: 'ord_malicious_123',
    orderNumber: 'SELA-261030-<script>alert("bad")</script>',
    table: { tableNumber: '07"><img src=x onerror=alert(1)>' },
    createdAt: new Date('2026-10-30T10:00:00Z'),
    paymentMethod: 'QRIS',
    paymentStatus: 'PAID',
    customerNotes: '<svg onload=alert("pwned")>Jangan terlalu manis',
    subtotalAmount: 35000,
    taxAmount: 0,
    serviceAmount: 0,
    totalAmount: 35000,
    items: [
      {
        nameSnapshot: 'Kopi Susu Aren <script>hack()</script>',
        priceSnapshot: 35000,
        quantity: 1,
        notes: '<b onmouseover=alert(1)>Ekstra es</b>',
        subtotal: 35000,
        modifiers: [
          {
            nameSnapshot: 'Less Sugar <iframe src="evil.com">',
            priceSnapshot: 0,
          },
        ],
      },
    ],
  }

  it('escapes item names, modifiers, and item notes in customer HTML receipt', () => {
    const htmlOutput = generatePrintableHtml({
      type: 'customer',
      paper: '58mm',
      order: maliciousOrder,
      isReprint: false,
    })

    // Pastikan tidak ada raw HTML injection tag yang lolos ke dokumen
    expect(htmlOutput).not.toContain('<script>')
    expect(htmlOutput).not.toContain('<img src=x')
    expect(htmlOutput).not.toContain('<iframe')
    expect(htmlOutput).not.toContain('<b onmouseover')

    // Pastikan karakter berbahaya di-escape secara aman
    expect(htmlOutput).toContain('&lt;script&gt;')
    expect(htmlOutput).toContain('&lt;iframe')

    // Pastikan meta Content-Security-Policy terpasang
    expect(htmlOutput).toContain(
      '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; script-src \'unsafe-inline\';">'
    )
  })

  it('escapes customer notes in kitchen ticket HTML', () => {
    const kitchenHtml = generatePrintableHtml({
      type: 'kitchen',
      paper: '80mm',
      order: maliciousOrder,
      isReprint: false,
    })

    expect(kitchenHtml).not.toContain('<svg onload')
    expect(kitchenHtml).toContain('&lt;svg onload')
  })
})
