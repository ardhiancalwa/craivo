import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

// Load .env
const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf-8')
let directUrl = ''
for (const line of envContent.split('\n')) {
  if (line.startsWith('DIRECT_URL=')) {
    const parts = line.split('=')
    directUrl = parts[1]?.trim().replace(/^["']|["']$/g, '') || ''
  }
}

if (!directUrl) {
  console.error('❌ DIRECT_URL tidak ditemukan di .env')
  process.exit(1)
}

// Tambahkan schema=cravio_staging ke URL koneksi
const stagingUrl = new URL(directUrl)
stagingUrl.searchParams.set('schema', 'cravio_staging')

console.log(`🚀 [STAGING-DEPLOY] Menjalankan Prisma Migrate Deploy ke schema cravio_staging...`)
console.log(`   Host: ${stagingUrl.host}, Schema: ${stagingUrl.searchParams.get('schema')}`)

try {
  const output = execSync('npx prisma migrate deploy', {
    env: {
      ...process.env,
      DATABASE_URL: stagingUrl.toString(),
      DIRECT_URL: stagingUrl.toString(),
    },
    encoding: 'utf-8',
    stdio: 'pipe',
  })
  console.log('✅ [STAGING-DEPLOY] Output:\n' + output)
} catch (err: any) {
  console.error('❌ [STAGING-DEPLOY] Error executing prisma migrate deploy:')
  console.error('STDOUT:', err.stdout?.toString())
  console.error('STDERR:', err.stderr?.toString())
  console.error('MESSAGE:', err.message)
  process.exit(1)
}

