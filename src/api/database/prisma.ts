import { PrismaClient } from '@prisma/client';

// Create a singleton instance of the Prisma client
const prismaClientSingleton = () => {
  return new PrismaClient();
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

// Use existing client if available, otherwise create a new one
export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

// In development, don't keep the connection between hot reloads
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}