import { PrismaClient } from '@prisma/client'
import fs from 'node:fs'
import path from 'node:path'

// Load .env or .env.local
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

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!connectionString) {
  console.error('❌ DIRECT_URL atau DATABASE_URL tidak ditemukan di .env')
  process.exit(1)
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: connectionString,
    },
  },
})

async function main() {
  console.log('🔄 [SCHEMAS] Memeriksa dan menyiapkan schema PostgreSQL di Neon...')

  // 1. Periksa schema yang ada
  const existingSchemas = await prisma.$queryRawUnsafe<Array<{ schema_name: string }>>(
    `SELECT schema_name FROM information_schema.schemata;`
  )
  const schemaNames = existingSchemas.map((s) => s.schema_name)
  console.log('📋 Existing schemas:', schemaNames)

  // 2. Pastikan cravio_staging ada
  if (!schemaNames.includes('cravio_staging')) {
    console.log('⚙️ Membuat schema cravio_staging...')
    await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS cravio_staging;`)
    console.log('✅ Schema cravio_staging berhasil dibuat!')
  } else {
    console.log('✅ Schema cravio_staging sudah tersedia.')
  }

  // 3. Pastikan cravio_restore_drill ada
  if (!schemaNames.includes('cravio_restore_drill')) {
    console.log('⚙️ Membuat schema cravio_restore_drill...')
    await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS cravio_restore_drill;`)
    console.log('✅ Schema cravio_restore_drill berhasil dibuat!')
  } else {
    console.log('✅ Schema cravio_restore_drill sudah tersedia.')
  }
}

main()
  .catch((e) => {
    console.error('❌ Gagal menyiapkan schema:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
