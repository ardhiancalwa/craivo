import { NextResponse } from 'next/server'
import { getCafeConfig } from '@/lib/server/config-service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const config = await getCafeConfig()

    return NextResponse.json({
      success: true,
      data: {
        enableMidtransQris: config.enableMidtransQris,
        enableCash: config.enableCash,
        enableManualQris: config.enableManualQris,
        manualQrisImageUrl: config.manualQrisImageUrl,
        manualQrisName: config.manualQrisName,
        enableManualTransfer: config.enableManualTransfer,
        manualTransferBank: config.manualTransferBank,
        manualTransferAccount: config.manualTransferAccount,
        manualTransferName: config.manualTransferName,
      },
    })
  } catch (err) {
    console.error('Failed to get public payment methods:', err)
    return NextResponse.json(
      {
        success: true,
        data: {
          enableMidtransQris: true,
          enableCash: true,
          enableManualQris: false,
          enableManualTransfer: false,
        },
      },
      { status: 200 }
    )
  }
}

