import { PrismaClient } from '@prisma/client';
import { initializeDatabase } from './initializeDatabase';

async function main() {
  console.log('Initializing database...');
  
  const prisma = new PrismaClient();
  
  try {
    await initializeDatabase(prisma);
    console.log('Database initialization complete');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().then();