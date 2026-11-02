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

const targetUrl = process.env.DATABASE_URL || directUrl
const prisma = new PrismaClient({
  datasources: { db: { url: targetUrl } }
})

async function main() {
  const config = await prisma.cravioConfig.findFirst()
  console.log('Current Config Record:', config)

  const tables = await prisma.table.count()
  const menuItems = await prisma.menuItem.count()
  console.log(`Tables: ${tables}, MenuItems: ${menuItems}`)
}

main().finally(() => prisma.$disconnect())
