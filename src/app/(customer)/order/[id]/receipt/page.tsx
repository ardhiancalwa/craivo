import {
  verifyOrderOrStaffAccess,
  OrderAccessError,
} from '@/lib/server/order-access'
import { getPrintSummary } from '@/lib/server/print-service'
import { OrderAccessDenied } from '@/components/order/order-access-denied'
import { OrderReceiptClientView } from './receipt-client-view'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function OrderReceiptPage({ params }: PageProps) {
  const { id } = await params

  let access: Awaited<ReturnType<typeof verifyOrderOrStaffAccess>>
  let printSummary: Awaited<ReturnType<typeof getPrintSummary>>

  try {
    access = await verifyOrderOrStaffAccess(id, undefined, {
      allowedRoles: ['CASHIER', 'ADMIN', 'BARISTA'],
      allowCustomer: true,
    })
    printSummary = await getPrintSummary(id, 'CUSTOMER_RECEIPT')
  } catch (err: unknown) {
    if (err instanceof OrderAccessError) {
      return <OrderAccessDenied />
    }
    return <OrderAccessDenied />
  }

  return (
    <OrderReceiptClientView
      order={access.order}
      initialReprintCount={printSummary.reprintCount}
    />
  )
}
