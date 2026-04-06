import { pgTable, varchar, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const meetingsTable = pgTable("meetings", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull(),
  leadId: varchar("lead_id").notNull(),
  leadName: varchar("lead_name").notNull(),
  leadCompany: varchar("lead_company").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  purpose: text("purpose").notNull(),
  status: varchar("status").notNull().default("scheduled"),
  emailSubject: text("email_subject"),
  emailBody: text("email_body"),
  prepNotes: text("prep_notes"),
  meetingNotes: text("meeting_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tasksTable = pgTable("tasks", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  meetingId: varchar("meeting_id").notNull(),
  userId: varchar("user_id").notNull(),
  description: text("description").notNull(),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMeetingSchema = createInsertSchema(meetingsTable).omit({ id: true, createdAt: true });
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
export type Meeting = typeof meetingsTable.$inferSelect;

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
