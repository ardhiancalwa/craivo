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

const targetUrl = process.env.DATABASE_URL || process.env.DIRECT_URL
if (!targetUrl) {
  console.error('❌ DATABASE_URL tidak ditemukan.')
  process.exit(1)
}

const prisma = new PrismaClient({
  datasources: { db: { url: targetUrl } },
})

const SELA_CONFIG_ID = 'cravio-main-config'

async function syncProductionIdentity() {
  console.log('🔄 [IDENTITY-SYNC] Menyelaraskan identitas resmi SELA Artisanal Coffee & Bake...')

  // 1. Update / Upsert CravioConfig
  const updatedConfig = await prisma.cravioConfig.upsert({
    where: { id: SELA_CONFIG_ID },
    create: {
      id: SELA_CONFIG_ID,
      name: 'SELA Artisanal Coffee & Bake',
      tagline: 'Artisanal Coffee & Thoughtful Bakes',
      address: 'Jl. Cimanuk No. 12, Citarum, Kec. Bandung Wetan, Kota Bandung, Jawa Barat 40115',
      phone: '+62 812-2233-4455',
      openingHours: '07:00 - 22:00 WIB',
      timezone: 'Asia/Jakarta',
      currency: 'IDR',
      taxRateBps: 0,
      serviceRateBps: 0,
      isTaxInclusive: false,
      qrisTimeoutMinutes: 15,
      cashTimeoutMinutes: 20,
      quizVersion: 1,
      productionDomain: 'https://sela.cravio.id',
    },
    update: {
      name: 'SELA Artisanal Coffee & Bake',
      tagline: 'Artisanal Coffee & Thoughtful Bakes',
      address: 'Jl. Cimanuk No. 12, Citarum, Kec. Bandung Wetan, Kota Bandung, Jawa Barat 40115',
      phone: '+62 812-2233-4455',
      openingHours: '07:00 - 22:00 WIB',
      timezone: 'Asia/Jakarta',
      currency: 'IDR',
      taxRateBps: 0,
      serviceRateBps: 0,
      isTaxInclusive: false,
      qrisTimeoutMinutes: 15,
      cashTimeoutMinutes: 20,
      productionDomain: 'https://sela.cravio.id',
    },
  })

  console.log('✅ [IDENTITY-SYNC] Konfigurasi kafe berhasil diselaraskan:')
  console.log(`   - Nama Resmi: ${updatedConfig.name}`)
  console.log(`   - Tagline: ${updatedConfig.tagline}`)
  console.log(`   - Alamat: ${updatedConfig.address}`)
  console.log(`   - Telepon: ${updatedConfig.phone}`)
  console.log(`   - Jam Operasional: ${updatedConfig.openingHours}`)
  console.log(`   - Domain Produksi: ${updatedConfig.productionDomain}`)

  // 2. Selaraskan Label 12 Meja Kafe SELA
  const tableLabels: Record<string, string> = {
    '01': 'Area Bar 01',
    '02': 'Area Bar 02',
    '03': 'Area Bar 03',
    '04': 'Area Bar 04',
    '05': 'Indoor Dining 05',
    '06': 'Indoor Dining 06',
    '07': 'Indoor Dining 07',
    '08': 'Indoor Dining 08',
    '09': 'Outdoor Patio 09',
    '10': 'Outdoor Patio 10',
    '11': 'Outdoor Patio 11',
    '12': 'Outdoor Patio 12',
  }

  console.log('🔄 [TABLES-SYNC] Memeriksa dan memperbarui label 12 meja kafe...')
  for (const [tableNum, label] of Object.entries(tableLabels)) {
    await prisma.table.upsert({
      where: { tableNumber: tableNum },
      create: {
        tableNumber: tableNum,
        label,
        qrSlug: `sela-table-${tableNum}`,
        isActive: true,
      },
      update: {
        label,
        isActive: true,
      },
    })
  }

  const allTables = await prisma.table.findMany({
    orderBy: { tableNumber: 'asc' },
    select: { tableNumber: true, label: true, isActive: true },
  })

  console.log(`✅ [TABLES-SYNC] ${allTables.length} meja berhasil diverifikasi & dilabeli:`)
  allTables.forEach((t) => {
    console.log(`   - Meja ${t.tableNumber}: ${t.label} (Aktif: ${t.isActive})`)
  })
}

if (require.main === module) {
  syncProductionIdentity()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Gagal sinkronisasi identitas produksi:', err)
      process.exit(1)
    })
    .finally(() => prisma.$disconnect())
}
