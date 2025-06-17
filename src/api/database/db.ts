// Re-export the Prisma client as db for backward compatibility
import {prisma, getPrismaClient} from './prisma';
import {Prisma} from "@prisma/client";

// Export the Prisma client directly for backward compatibility
export const db = prisma;

// Initialize the database when this module is imported
(async () => {
    try {
        // This ensures the database is initialized before any queries are executed
        await getPrismaClient();
        console.log('Database client ready');
    } catch (error) {
        console.error('Failed to initialize database client:', error);
    }
})();

export async function updateUser(id: string, update: Prisma.UserUpdateArgs["data"]) {
    const user = await db.user.findUnique({ where: { id: id } });
    if (!user) {
        return;
    }

    await db.user.update({
        messages: update,
        where: { id }
    });
}