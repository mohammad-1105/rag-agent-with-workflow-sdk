import type { Config } from "drizzle-kit";
import "./envConfig";

export default {
  schema: "./lib/db/schema",
  dialect: "postgresql",
  out: "./lib/db/migrations",
  dbCredentials: {
    // biome-ignore lint/style/noNonNullAssertion: <>
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
