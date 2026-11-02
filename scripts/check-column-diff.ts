import { PrismaClient } from '@prisma/client'
import fs from 'node:fs'

const envContent = fs.readFileSync('.env', 'utf-8')
let directUrl = ''
for (const line of envContent.split('\n')) {
  if (line.startsWith('DIRECT_URL=')) {
    const parts = line.split('=')
    directUrl = parts[1]?.trim().replace(/^["']|["']$/g, '') || ''
  }
}

const prisma = new PrismaClient({
  datasources: { db: { url: directUrl } }
})

async function main() {
  const diffColumns = await prisma.$queryRawUnsafe<Array<{ table_name: string; column_name: string }>>(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    EXCEPT
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'cravio_staging';
  `)

  console.log('Columns in public but NOT in cravio_staging:', diffColumns)
}

main().finally(() => prisma.$disconnect())

