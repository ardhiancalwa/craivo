import { cookies } from 'next/headers'
import { getCatalogData } from '@/lib/server/menu-service'
import { validateTableServer } from '@/lib/server/table-service'
import { MenuClientView } from '@/components/menu/menu-client-view'

interface PageProps {
  searchParams: Promise<{ table?: string; category?: string; search?: string }>
}

export default async function CustomerMenuPage({ searchParams }: PageProps) {
  const params = await searchParams
  const cookieStore = await cookies()
  const cookieTable = cookieStore.get('cravio_table')?.value

  // Priority: explicit URL query param -> session cookie
  const candidateTable = params.table || cookieTable || null

  // Validate candidate table against database (never default to a fake table!)
  let validatedTableNumber: string | null = null
  let isTableValid = false

  if (candidateTable) {
    const tableValidation = await validateTableServer(candidateTable)
    if (tableValidation.status === 'VALID' && tableValidation.table) {
      validatedTableNumber = tableValidation.table.tableNumber
      isTableValid = true
    }
  }

  // Fetch real catalog from PostgreSQL database
  const catalog = await getCatalogData(params.category, params.search)

  return (
    <MenuClientView
      initialCategories={catalog.categories}
      initialItems={catalog.items}
      tableNumber={validatedTableNumber}
      isTableValid={isTableValid}
    />
  )
}
