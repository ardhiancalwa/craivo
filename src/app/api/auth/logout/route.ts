import { NextResponse } from 'next/server'
import prisma from '@/lib/server/db'
import { getAuthenticatedStaff } from '@/lib/server/auth-guard'
import { STAFF_COOKIE_NAME } from '@/lib/server/auth'

export async function POST(request: Request) {
  const staff = await getAuthenticatedStaff(request)

  if (staff) {
    const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1'
    await prisma.auditLog.create({
      data: {
        staffUserId: staff.sub,
        action: 'STAFF_LOGOUT',
        details: JSON.stringify({ username: staff.username }),
        ipAddress,
      },
    })
  }

  const response = NextResponse.json({
    success: true,
    message: 'Sesi staf berhasil diakhiri.',
  })

  // Clear cookie
  response.cookies.set({
    name: STAFF_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })

  return response
}

