import { cookies } from 'next/headers'
import { CartClientView } from './cart-client-view'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ table?: string }>
}

export default async function CustomerCartPage({ searchParams }: PageProps) {
  const params = await searchParams
  const cookieStore = await cookies()
  const tableCookie = cookieStore.get('cravio_table')?.value

  // Prioritas nomor meja: URL query param -> cookie sesi meja resmi (tanpa fallback diam-diam)
  const tableNumber = params.table?.trim() || tableCookie || ''

  return <CartClientView tableNumber={tableNumber} />
}
