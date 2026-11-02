import { redirect } from 'next/navigation'
import { getAuthenticatedStaff } from '@/lib/server/auth-guard'
import prisma from '@/lib/server/db'
import { PrintSheetClientView } from './print-sheet-client-view'

export const dynamic = 'force-dynamic'

export default async function TablePrintSheetPage() {
  const staff = await getAuthenticatedStaff()

  if (!staff || staff.role !== 'ADMIN') {
    redirect('/login')
  }

  const [tables, config] = await Promise.all([
    prisma.table.findMany({
      where: { isActive: true },
      orderBy: { tableNumber: 'asc' },
    }),
    prisma.cravioConfig.findUnique({ where: { id: 'cravio-main-config' } }),
  ])

  const stagingBaseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'http://localhost:3000'
  ).replace(/\/+$/, '')

  const productionDomain = config?.productionDomain?.trim() || process.env.PRODUCTION_DOMAIN?.trim() || null
  const isProductionReady = Boolean(
    productionDomain &&
      /^https?:\/\//i.test(productionDomain) &&
      !productionDomain.includes('localhost') &&
      !productionDomain.includes('127.0.0.1')
  )

  return (
    <PrintSheetClientView
      tables={tables}
      cafeName={config?.name || 'SELA Artisanal Coffee & Bake'}
      stagingBaseUrl={stagingBaseUrl}
      productionDomain={productionDomain}
      isProductionReady={isProductionReady}
    />
  )
}

