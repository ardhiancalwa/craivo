import 'server-only'
import { prisma } from './db'

export interface CatalogCategory {
  id: string
  name: string
  slug: string
  sortOrder: number
}

export interface CatalogModifierOption {
  id: string
  groupId: string
  name: string
  price: number // Integer IDR tambahan (e.g. 0, 8000)
  isAvailable: boolean
}

export interface CatalogModifierGroup {
  id: string
  name: string
  isRequired: boolean
  minSelect: number
  maxSelect: number
  options: CatalogModifierOption[]
}

export interface CatalogMenuItem {
  id: string
  name: string
  description: string
  price: number // Integer IDR (e.g. 28000)
  image: string | null
  categoryId: string
  categoryName: string
  categorySlug: string
  isAvailable: boolean
  isPopular: boolean
  soldCount: number
  tags: Array<{ id: string; name: string; slug: string; dimension: string }>
  modifierGroups: CatalogModifierGroup[]
}

export interface CatalogResponseData {
  categories: CatalogCategory[]
  items: CatalogMenuItem[]
}

export async function getCatalogData(
  categorySlug?: string,
  searchQuery?: string
): Promise<CatalogResponseData> {
  // 1. Fetch real categories from database
  const dbCategories = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      sortOrder: true,
    },
  })

  // Prepended virtual category "Semua" (UI-only aggregate, not in DB)
  const categories: CatalogCategory[] = [
    { id: 'semua', name: 'Semua', slug: 'semua', sortOrder: 0 },
    ...dbCategories,
  ]

  // 2. Build where filter for Menu Items
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause: any = {
    isArchived: false,
  }

  // Filter by category if slug is specified and not 'semua'
  if (categorySlug && categorySlug !== 'semua') {
    whereClause.category = {
      slug: categorySlug,
    }
  }

  // Filter by search query if provided
  if (searchQuery && searchQuery.trim().length > 0) {
    const cleanedSearch = searchQuery.trim()
    whereClause.OR = [
      { name: { contains: cleanedSearch, mode: 'insensitive' } },
      { description: { contains: cleanedSearch, mode: 'insensitive' } },
    ]
  }

  // 3. Query menu items with relations
  const dbItems = await prisma.menuItem.findMany({
    where: whereClause,
    include: {
      category: true,
      tags: {
        include: {
          tag: true,
        },
      },
      modifierGroups: {
        include: {
          group: {
            include: {
              options: {
                where: { isAvailable: true },
                orderBy: { price: 'asc' },
              },
            },
          },
        },
      },
    },
    orderBy: [{ isPopular: 'desc' }, { name: 'asc' }],
  })

  // 4. Format items cleanly into client-safe payload
  const items: CatalogMenuItem[] = dbItems.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    price: item.price,
    image: item.image,
    categoryId: item.categoryId,
    categoryName: item.category.name,
    categorySlug: item.category.slug,
    isAvailable: item.isAvailable,
    isPopular: item.isPopular,
    soldCount: item.soldCount,
    tags: item.tags.map((t) => ({
      id: t.tag.id,
      name: t.tag.name,
      slug: t.tag.slug,
      dimension: t.tag.dimension,
    })),
    modifierGroups: (() => {
      const overrides = (item.modifierPriceOverrides as Record<string, number> | null) || {}
      return item.modifierGroups.map((mg) => ({
        id: mg.group.id,
        name: mg.group.name,
        isRequired: mg.group.isRequired,
        minSelect: mg.group.minSelect,
        maxSelect: mg.group.maxSelect,
        options: mg.group.options.map((opt) => ({
          id: opt.id,
          groupId: opt.groupId,
          name: opt.name,
          price: typeof overrides[opt.id] === 'number' ? (overrides[opt.id] as number) : opt.price,
          isAvailable: opt.isAvailable,
        })),
      }))
    })(),
  }))

  return {
    categories,
    items,
  }
}
