import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    app: process.env.NEXT_PUBLIC_BRAND_NAME || 'Cravio',
    pilot: process.env.NEXT_PUBLIC_CAFE_NAME || 'SELA Artisanal Coffee & Bake',
    version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0-rc1',
    commit: process.env.NEXT_PUBLIC_COMMIT_SHA || 'staging-rc',
    timestamp: new Date().toISOString(),
  })
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}
