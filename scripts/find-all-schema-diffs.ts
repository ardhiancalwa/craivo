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
  const missingTables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    EXCEPT
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'cravio_staging' AND table_type = 'BASE TABLE';
  `)

  console.log('Tables in public but NOT in cravio_staging:', missingTables.map(t => t.table_name))

  const missingColumns = await prisma.$queryRawUnsafe<Array<{ table_name: string; column_name: string; data_type: string; is_nullable: string; column_default: string | null }>>(`
    SELECT c.table_name, c.column_name, c.data_type, c.is_nullable, c.column_default
    FROM information_schema.columns c
    JOIN information_schema.tables t ON c.table_name = t.table_name AND t.table_schema = 'public'
    WHERE c.table_schema = 'public'
    EXCEPT
    SELECT c.table_name, c.column_name, c.data_type, c.is_nullable, c.column_default
    FROM information_schema.columns c
    JOIN information_schema.tables t ON c.table_name = t.table_name AND t.table_schema = 'cravio_staging'
    WHERE c.table_schema = 'cravio_staging';
  `)

  console.log('Columns diff:', missingColumns)
}

main().finally(() => prisma.$disconnect())

