import { pgTable, varchar, real, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const leadsTable = pgTable("leads", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull(),
  name: varchar("name").notNull(),
  company: varchar("company").notNull(),
  title: varchar("title").notNull(),
  score: real("score").notNull(),
  reason: text("reason").notNull(),
  assets: text("assets").notNull(),
  sales: text("sales").notNull(),
  reasoning: text("reasoning").notNull(),
  email: varchar("email"),
  phone: varchar("phone"),
  linkedIn: varchar("linked_in"),
  location: varchar("location"),
  industry: varchar("industry"),
  aum: varchar("aum"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLeadSchema = createInsertSchema(leadsTable).omit({ id: true, createdAt: true });
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leadsTable.$inferSelect;
