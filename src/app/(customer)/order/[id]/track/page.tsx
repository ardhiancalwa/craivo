import {
  extractOrderSecretToken,
  verifyOrderAccess,
  OrderAccessError,
} from '@/lib/server/order-access'
import { OrderAccessDenied } from '@/components/order/order-access-denied'
import { TrackerClientView } from './tracker-client-view'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function OrderTrackPage({ params }: PageProps) {
  const { id } = await params

  let order: Awaited<ReturnType<typeof verifyOrderAccess>>
  try {
    const token = await extractOrderSecretToken(id)
    order = await verifyOrderAccess(id, token)
  } catch (err: unknown) {
    if (err instanceof OrderAccessError) {
      return <OrderAccessDenied />
    }
    return <OrderAccessDenied />
  }

  return <TrackerClientView initialOrder={order} />
}
