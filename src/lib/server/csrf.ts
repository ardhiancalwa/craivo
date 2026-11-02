import 'server-only'

/**
 * Validates the Origin and Host headers for mutating HTTP requests (POST, PUT, PATCH, DELETE).
 * Protects against cross-site request forgery attacks on cookie-authenticated endpoints.
 */
export function verifyCsrfOrigin(request: Request): boolean {
  const method = request.method.toUpperCase()
  // Safe HTTP methods do not mutate state
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return true
  }

  const origin = request.headers.get('origin')
  const host = request.headers.get('host')

  // In non-browser environments or automated testing where Origin is omitted:
  if (!origin) {
    return true
  }

  try {
    const originUrl = new URL(origin)
    // Check if origin host matches the current request host
    if (host && originUrl.host === host) {
      return true
    }

    // Also check against NEXT_PUBLIC_APP_URL if defined
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (appUrl) {
      const allowedApp = new URL(appUrl)
      if (originUrl.host === allowedApp.host) {
        return true
      }
    }

    return false
  } catch {
    return false
  }
}

