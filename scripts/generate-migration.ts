import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

// Load .env
const envContent = fs.readFileSync('.env', 'utf-8')
let directUrl = ''
for (const line of envContent.split('\n')) {
  if (line.startsWith('DIRECT_URL=')) {
    const parts = line.split('=')
    directUrl = parts[1]?.trim().replace(/^["']|["']$/g, '') || ''
  }
}

const stagingUrl = `${directUrl}?schema=cravio_staging`

console.log('🔄 Menghasilkan SQL diff migrasi forward-compatible...')
const diff = execSync(
  `npx prisma migrate diff --from-url "${stagingUrl}" --to-schema-datamodel prisma/schema.prisma --script`,
  { encoding: 'utf-8' }
)

console.log('--- GENERATED SQL ---')
console.log(diff)

const migrationDir = path.resolve(
  process.cwd(),
  'prisma',
  'migrations',
  '20261102150000_release_candidate_operational_sync'
)

if (!fs.existsSync(migrationDir)) {
  fs.mkdirSync(migrationDir, { recursive: true })
}

fs.writeFileSync(path.join(migrationDir, 'migration.sql'), diff)
console.log(`✅ Migrasi berhasil disimpan di: ${migrationDir}/migration.sql`)

