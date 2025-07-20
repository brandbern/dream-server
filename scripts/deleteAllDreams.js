import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main () {
  try {
    await prisma.dream.deleteMany({})
    console.log('All dreams have been deleted.')
  } catch (error) {
    console.error('Error deleting dreams:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
