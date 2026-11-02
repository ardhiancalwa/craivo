import { NextResponse } from 'next/server'
import prisma from '@/lib/server/db'
import { getAuthenticatedStaff } from '@/lib/server/auth-guard'

export async function GET(request: Request) {
  const payload = await getAuthenticatedStaff(request)

  if (!payload) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'Belum login.' },
      { status: 401 }
    )
  }

  const staff = await prisma.staffUser.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  })

  if (!staff || !staff.isActive) {
    return NextResponse.json(
      { error: 'ACCOUNT_DEACTIVATED', message: 'Akun staf dinonaktifkan.' },
      { status: 403 }
    )
  }

  return NextResponse.json({
    success: true,
    user: staff,
    staff: {
      id: staff.id,
      name: staff.displayName || staff.username,
      username: staff.username,
      role: staff.role,
    },
  })
}

