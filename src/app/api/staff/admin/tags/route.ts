import { NextResponse } from 'next/server'
import prisma from '@/lib/server/db'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    await requireStaffRole(['ADMIN'], request)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Akses ditolak.' }, { status: 401 })
  }

  const tags = await prisma.tag.findMany({
    orderBy: [{ dimension: 'asc' }, { name: 'asc' }],
  })

  return NextResponse.json({
    success: true,
    data: tags.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      dimension: t.dimension,
    })),
  })
}

