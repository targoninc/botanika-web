// Re-export the Prisma client as db for backward compatibility
import { prisma } from './prisma';

export const db = prisma;
