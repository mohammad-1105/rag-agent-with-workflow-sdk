import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import "../../envConfig";

// biome-ignore lint/style/noNonNullAssertion: <>
const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client);
