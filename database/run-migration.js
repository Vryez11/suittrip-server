import mysql from 'mysql2/promise';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  try {
    console.log('📦 Database connection established');

    // Read migration file
    const migrationPath = join(__dirname, 'migrations', '001_add_categories_column.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    console.log('🔄 Running migration: 001_add_categories_column.sql');

    // Execute migration
    const [results] = await connection.query(sql);

    console.log('✅ Migration completed successfully');
    console.log(results);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
    console.log('🔌 Database connection closed');
  }
}

runMigration();
