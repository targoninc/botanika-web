import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Initializes the database by checking if the required tables exist
 * and running the initialization script if needed.
 */
export async function initializeDatabase(prisma: PrismaClient): Promise<void> {
  try {
    // Try to query the users table to check if the database is initialized
    await prisma.$queryRaw`SELECT 1 FROM public.users LIMIT 1`;
    console.log('Database already initialized');
  } catch (error) {
    console.log('Database not initialized, running initialization script...');

    try {
      // Run the db_setup.sql script
      const dbSetupPath = path.join(process.cwd(), 'src', 'api', 'database', 'db_setup.sql');
      console.log(`Reading SQL file from: ${dbSetupPath}`);

      if (!fs.existsSync(dbSetupPath)) {
        throw new Error(`SQL file not found at: ${dbSetupPath}`);
      }

      const dbSetupSql = fs.readFileSync(dbSetupPath, 'utf8');
      console.log(`SQL file read successfully, length: ${dbSetupSql.length} characters`);

      // Split the SQL into individual statements
      const statements = dbSetupSql
        .replace(/(\r\n|\n|\r)/gm, ' ') // Replace newlines with spaces
        .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
        .split(';') // Split on semicolons
        .map(statement => statement.trim())
        .filter(statement => statement.length > 0); // Remove empty statements

      console.log(`Executing ${statements.length} SQL statements...`);

      // Execute each statement separately
      for (const statement of statements) {
        try {
          await prisma.$executeRawUnsafe(`${statement};`);
        } catch (statementError) {
          console.error(`Error executing statement: ${statement}`);
          console.error(statementError);
          // Continue with the next statement
        }
      }

      console.log('Database initialized successfully');

      // Verify that the tables were created
      try {
        await prisma.$queryRaw`SELECT 1 FROM public.users LIMIT 1`;
        await prisma.$queryRaw`SELECT 1 FROM public.chats LIMIT 1`;
        await prisma.$queryRaw`SELECT 1 FROM public.messages LIMIT 1`;
        console.log('Database tables verified successfully');
      } catch (verifyError) {
        console.error('Failed to verify database tables:', verifyError);
        throw verifyError;
      }
    } catch (initError) {
      console.error('Failed to initialize database:', initError);
      throw initError;
    }
  }
}
