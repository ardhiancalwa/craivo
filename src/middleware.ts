import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const STAFF_COOKIE_NAME = 'cravio_staff_token'

function getJwtSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET || 'fallback-minimum-32-chars-secret-key-12345678'
  return new TextEncoder().encode(secret)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Dapatkan atau buat Correlation ID untuk penelusuran request
  const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID()
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-correlation-id', correlationId)

  const attachCorrelationHeader = (response: NextResponse) => {
    response.headers.set('x-correlation-id', correlationId)
    return response
  }

  // 2. Webhooks dibebaskan dari autentikasi cookie staf Midtrans
  if (pathname.startsWith('/api/webhooks')) {
    return attachCorrelationHeader(
      NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      })
    )
  }

  // 3. Ekstrak token dari cookie atau Authorization header
  let token = request.cookies.get(STAFF_COOKIE_NAME)?.value

  if (!token) {
    const authHeader = request.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim()
    }
  }

  // 4. Tangani API staff endpoints (/api/staff/*)
  if (pathname.startsWith('/api/staff')) {
    // CSRF Check for mutating requests
    const method = request.method.toUpperCase()
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const origin = request.headers.get('origin')
      const host = request.headers.get('host')
      if (origin && host) {
        try {
          const originHost = new URL(origin).host
          if (originHost !== host) {
            return attachCorrelationHeader(
              NextResponse.json(
                { error: 'CSRF_REJECTED', message: 'Permintaan ditolak: Origin tidak cocok.' },
                { status: 403 }
              )
            )
          }
        } catch {
          return attachCorrelationHeader(
            NextResponse.json(
              { error: 'CSRF_REJECTED', message: 'Permintaan ditolak: Header origin tidak valid.' },
              { status: 403 }
            )
          )
        }
      }
    }

    if (!token) {
      return attachCorrelationHeader(
        NextResponse.json(
          { error: 'UNAUTHORIZED', message: 'Sesi tidak valid atau belum login.' },
          { status: 401 }
        )
      )
    }

    try {
      const secret = getJwtSecretKey()
      await jwtVerify(token, secret, { algorithms: ['HS256'] })
      return attachCorrelationHeader(
        NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        })
      )
    } catch {
      return attachCorrelationHeader(
        NextResponse.json(
          { error: 'UNAUTHORIZED', message: 'Token telah kedaluwarsa atau tidak valid.' },
          { status: 401 }
        )
      )
    }
  }

  // 5. Tangani UI staff pages (/staff/* or /kitchen/*)
  if (pathname.startsWith('/staff') || pathname.startsWith('/kitchen')) {
    if (!token) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return attachCorrelationHeader(NextResponse.redirect(loginUrl))
    }

    try {
      const secret = getJwtSecretKey()
      const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })
      const role = payload['role'] as string

      // Route-level perimeter check
      if (pathname.startsWith('/staff/admin') && role !== 'ADMIN') {
        const dest = role === 'CASHIER' ? '/staff/pos' : '/staff/kds'
        return attachCorrelationHeader(NextResponse.redirect(new URL(dest, request.url)))
      }

      if (pathname.startsWith('/staff/pos') && role === 'BARISTA') {
        return attachCorrelationHeader(NextResponse.redirect(new URL('/staff/kds', request.url)))
      }

      if (
        (pathname.startsWith('/staff/kds') ||
          pathname.startsWith('/kitchen') ||
          pathname.startsWith('/staff/kitchen')) &&
        role === 'CASHIER'
      ) {
        return attachCorrelationHeader(NextResponse.redirect(new URL('/staff/pos', request.url)))
      }

      return attachCorrelationHeader(
        NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        })
      )
    } catch {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return attachCorrelationHeader(NextResponse.redirect(loginUrl))
    }
  }

  // Rute publik lainnya (misal: /api/health, /api/orders, dsb.)
  return attachCorrelationHeader(
    NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  )
}

export const config = {
  matcher: ['/api/:path*', '/staff/:path*', '/kitchen/:path*'],
}
