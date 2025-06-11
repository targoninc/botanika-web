import { PrismaClient } from '@prisma/client';
import { initializeDatabase } from './initializeDatabase';

// Create a singleton instance of the Prisma client
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: ['error', 'warn'],
  });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
  isDbInitialized: boolean | undefined;
};

// Use existing client if available, otherwise create a new one
const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

// Initialize the database if it's fresh
let dbInitPromise: Promise<void> | null = null;

if (!globalForPrisma.isDbInitialized) {
  dbInitPromise = (async () => {
    try {
      console.log('Initializing database...');
      await initializeDatabase(prisma);
      globalForPrisma.isDbInitialized = true;
      console.log('Database initialization complete');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      globalForPrisma.isDbInitialized = false;
    }
  })();
}

// Export a function that ensures the database is initialized before returning the Prisma client
export const getPrismaClient = async () => {
  if (dbInitPromise) {
    await dbInitPromise;
    dbInitPromise = null;
  }
  return prisma;
};

// For backward compatibility, also export the Prisma client directly
// Note: This might cause issues if used before initialization is complete
export { prisma };

// In development, don't keep the connection between hot reloads
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
