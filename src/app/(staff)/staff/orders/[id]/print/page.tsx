import { redirect } from 'next/navigation'
import { verifyOrderOrStaffAccess, OrderAccessError } from '@/lib/server/order-access'
import { getPrintSummary } from '@/lib/server/print-service'
import { StaffPrintClientView } from './print-client-view'
import type { ReceiptDocumentType, ThermalPaperWidth } from '@/lib/receipt-formatter'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    type?: string
    paper?: string
    auto?: string
  }>
}

export default async function StaffOrderPrintPage({ params, searchParams }: PageProps) {
  const { id: orderId } = await params
  const { type: typeParam, paper: paperParam, auto: autoParam } = await searchParams

  let access: Awaited<ReturnType<typeof verifyOrderOrStaffAccess>>
  try {
    access = await verifyOrderOrStaffAccess(orderId, undefined, {
      allowedRoles: ['CASHIER', 'ADMIN', 'BARISTA'],
      allowCustomer: false, // Hanya staf yang diizinkan di rute /staff
    })
  } catch (err) {
    if (err instanceof OrderAccessError && err.statusCode === 401) {
      redirect('/login')
    }
    redirect('/staff/pos')
  }

  const { order, staffUser } = access

  // Ambil summary print status untuk kasir dan dapur
  const cashierSummary = await getPrintSummary(orderId, 'CASHIER_RECEIPT')
  const kitchenSummary = await getPrintSummary(orderId, 'KITCHEN_TICKET')

  // Default document type: jika Barista -> kitchen; jika Kasir -> cashier
  const initialType: ReceiptDocumentType =
    typeParam === 'kitchen' || staffUser?.role === 'BARISTA'
      ? 'kitchen'
      : 'cashier'

  const initialPaper: ThermalPaperWidth = paperParam === '80mm' ? '80mm' : '58mm'
  const autoPrint = autoParam === 'true'

  return (
    <StaffPrintClientView
      order={order}
      staffUser={staffUser}
      initialType={initialType}
      initialPaper={initialPaper}
      initialCashierReprintCount={cashierSummary.reprintCount}
      initialKitchenReprintCount={kitchenSummary.reprintCount}
      autoPrint={autoPrint}
    />
  )
}

