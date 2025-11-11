import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import "../../envConfig";

/**
 * Validates required environment variables
 * @throws {Error} If DATABASE_URL is not defined
 */
const validateEnvironment = (): void => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not defined");
  }
};

/**
 * Runs database migrations
 * @returns {Promise<void>}
 */
const runMigrate = async (): Promise<void> => {
  let connection: postgres.Sql | null = null;

  try {
    validateEnvironment();

    // Create connection with optimized settings for migrations
    // biome-ignore lint/style/noNonNullAssertion: <>
    connection = postgres(process.env.DATABASE_URL!, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
    });

    const db = drizzle(connection);
    // Enable pgvector extension first
    console.log("📦 Enabling pgvector extension...");
    await connection`CREATE EXTENSION IF NOT EXISTS vector`;
    console.log("✅ pgvector extension enabled");

    console.log("⏳ Running migrations...");
    const start = Date.now();

    await migrate(db, { migrationsFolder: "lib/db/migrations" });

    const duration = Date.now() - start;
    console.log(`✅ Migrations completed successfully in ${duration}ms`);
  } catch (error) {
    console.error("❌ Migration failed");

    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
      if (error.stack) {
        console.error("Stack trace:", error.stack);
      }
    } else {
      console.error("Unknown error:", error);
    }

    throw error;
  } finally {
    // Ensure connection is properly closed
    if (connection) {
      try {
        await connection.end({ timeout: 5 });
        console.log("🔌 Database connection closed");
      } catch (closeError) {
        console.error(
          "⚠️  Warning: Failed to close database connection",
          closeError,
        );
      }
    }
  }
};

// Execute migration with proper error handling
runMigrate()
  .then(() => {
    console.log("🎉 Migration process completed");
    process.exit(0);
  })
  .catch((err) => {
    console.error("💥 Fatal error during migration:", err);
    process.exit(1);
  });
