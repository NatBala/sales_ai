import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: ["./src/schema/leads.ts", "./src/schema/meetings.ts", "./src/schema/auth.ts"],
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
