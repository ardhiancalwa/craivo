import { PrismaClient } from '@prisma/client'
import fs from 'node:fs'
import path from 'node:path'

// Load .env
const envFiles = ['.env.local', '.env']
for (const file of envFiles) {
  const filePath = path.resolve(process.cwd(), file)
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const equalIdx = trimmed.indexOf('=')
        if (equalIdx > 0) {
          const key = trimmed.slice(0, equalIdx).trim()
          let val = trimmed.slice(equalIdx + 1).trim()
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1)
          }
          if (process.env[key] === undefined) {
            process.env[key] = val
          }
        }
      }
    }
  }
}

export interface OperationalAlert {
  alertId: string
  severity: 'P1-CRITICAL' | 'P2-HIGH' | 'P3-WARNING'
  category: 'PAYMENT_GATEWAY' | 'KDS_STALENESS' | 'BACKUP_RPO' | 'DATABASE_HEALTH'
  event: string
  message: string
  assignedPic: {
    role: string
    title: string
    slaResponseMinutes: number
  }
  metricDetails: Record<string, any>
  recommendedAction: string
}

export async function runAlertSimulation(): Promise<OperationalAlert[]> {
  const alerts: OperationalAlert[] = []
  const correlationId = `sim-alert-${Date.now()}`

  console.log(`🚨 [CRAVIO-OPS] Memulai audit monitoring & simulasi operational alert...`)
  console.log(`   Correlation ID: ${correlationId}`)

  const prisma = new PrismaClient({
    datasources: {
      db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL },
    },
  })

  try {
    const now = new Date()

    // 1. Audit Simulasi P1: Webhook Failure Spike
    const recentFailedLogs = await prisma.auditLog.count({
      where: {
        action: { contains: 'WEBHOOK' },
        details: { contains: 'FAIL' },
        createdAt: { gte: new Date(now.getTime() - 15 * 60 * 1000) },
      },
    })

    // Skenario simulasi P1
    alerts.push({
      alertId: `ALT-P1-${Date.now()}-01`,
      severity: 'P1-CRITICAL',
      category: 'PAYMENT_GATEWAY',
      event: 'MIDTRANS_WEBHOOK_FAILURE_SPIKE',
      message: 'Deteksi kegagalan verifikasi signature webhook Midtrans atau koneksi gateway terputus.',
      assignedPic: {
        role: 'PRIMARY_OPS',
        title: 'Technical Lead Cravio (Backend & Gateway)',
        slaResponseMinutes: 5,
      },
      metricDetails: {
        recentFailures15m: recentFailedLogs,
        threshold: 3,
        correlationId,
      },
      recommendedAction:
        'Segera periksa audit logs Midtrans di portal merchant, validasi SERVER_KEY, dan jalankan rekonsiliasi manual via cron endpoint.',
    })

    // 2. Audit Simulasi P2: Pending Payment Aging (> 15 Menit)
    const pendingAgingCount = await prisma.order.count({
      where: {
        paymentStatus: 'PENDING',
        createdAt: { lt: new Date(now.getTime() - 15 * 60 * 1000) },
      },
    })

    if (pendingAgingCount > 0) {
      alerts.push({
        alertId: `ALT-P2-${Date.now()}-02`,
        severity: 'P2-HIGH',
        category: 'PAYMENT_GATEWAY',
        event: 'PENDING_PAYMENTS_AGING_EXPIRATION',
        message: `${pendingAgingCount} pesanan QRIS dalam status PENDING telah berumur > 15 menit tanpa notifikasi settlement.`,
        assignedPic: {
          role: 'SECONDARY_OPS',
          title: 'Store Manager / Kasir Kafe On-Duty',
          slaResponseMinutes: 15,
        },
        metricDetails: {
          pendingAgingCount,
          qrisTimeoutMinutes: 15,
          correlationId,
        },
        recommendedAction:
          'Minta kasir memeriksa status fisik pelanggan di meja, jalankan cron rekonsiliasi pembayaran untuk mengubah status menjadi EXPIRED atau PAID.',
      })
    }

    // 3. Audit Simulasi P2: KDS Staleness / Antrean Dapur Terhenti (> 30 Menit)
    const staleQueueCount = await prisma.order.count({
      where: {
        orderStatus: 'QUEUED',
        paymentStatus: 'PAID',
        createdAt: { lt: new Date(now.getTime() - 30 * 60 * 1000) },
      },
    })

    if (staleQueueCount > 0) {
      alerts.push({
        alertId: `ALT-P2-${Date.now()}-03`,
        severity: 'P2-HIGH',
        category: 'KDS_STALENESS',
        event: 'KITCHEN_QUEUE_STALENESS_EXCEEDED',
        message: `${staleQueueCount} pesanan lunas tertahan di antrean dapur (QUEUED) lebih dari 30 menit.`,
        assignedPic: {
          role: 'SECONDARY_OPS',
          title: 'Lead Barista / Head of Kitchen',
          slaResponseMinutes: 10,
        },
        metricDetails: {
          staleQueueCount,
          kitchenSlaMinutes: 30,
          correlationId,
        },
        recommendedAction:
          'Hubungi barista dapur untuk memeriksa koneksi Wi-Fi tablet KDS, pastikan layar KDS aktif dan status pesanan digeser ke COOKING.',
      })
    }

    // 4. Audit Simulasi P3: Disaster Recovery RPO Freshness (> 24 Jam)
    const backupDir = path.resolve(process.cwd(), 'backups')
    let lastBackupAgeHours = 999
    if (fs.existsSync(backupDir)) {
      const manifests = fs
        .readdirSync(backupDir)
        .filter((f) => f.endsWith('-manifest.json'))
        .sort()
        .reverse()

      const latestManifestFile = manifests[0]
      if (latestManifestFile) {
        const lastManifest = JSON.parse(fs.readFileSync(path.join(backupDir, latestManifestFile), 'utf-8'))
        const backupTime = new Date(lastManifest.timestamp).getTime()
        lastBackupAgeHours = Number(((now.getTime() - backupTime) / (1000 * 60 * 60)).toFixed(2))
      }
    }

    if (lastBackupAgeHours > 24) {
      alerts.push({
        alertId: `ALT-P3-${Date.now()}-04`,
        severity: 'P3-WARNING',
        category: 'BACKUP_RPO',
        event: 'BACKUP_RPO_THRESHOLD_BREACHED',
        message: `Cadangan database terakhir berumur ${lastBackupAgeHours} jam (melebihi batas RPO 24 jam).`,
        assignedPic: {
          role: 'PRIMARY_OPS',
          title: 'DevOps / Lead Technical Cravio',
          slaResponseMinutes: 60,
        },
        metricDetails: {
          lastBackupAgeHours,
          rpoMaxHours: 24,
          correlationId,
        },
        recommendedAction:
          'Jalankan script `pnpm run backup` segera dan periksa log cron backup otomatis untuk memastikan snapshot terenkripsi tersimpan.',
      })
    }

    console.log(`📊 [CRAVIO-OPS] Hasil Audit Simulasi: ${alerts.length} alert aktif terdeteksi.`)
    for (const a of alerts) {
      console.log(`   [${a.severity}] ${a.event}: ${a.message}`)
      console.log(`      -> PIC: ${a.assignedPic.title} (SLA: ${a.assignedPic.slaResponseMinutes}m)`)
    }

    return alerts
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  runAlertSimulation()
    .then((alerts) => {
      console.log('✅ [ALERT-SIMULATION-SUCCESS] Simulasi dan audit monitoring operasional selesai.')
      process.exit(0)
    })
    .catch((err) => {
      console.error('❌ [ALERT-SIMULATION-ERROR] Gagal menjalankan simulasi alert:', err)
      process.exit(1)
    })
}
