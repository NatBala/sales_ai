import { Router, type IRouter, type Request, type Response } from "express";
import { db, meetingsTable, tasksTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateMeetingBody, CreateTaskBody } from "@workspace/api-zod";

const router: IRouter = Router();

function formatMeeting(m: typeof meetingsTable.$inferSelect) {
  return {
    id: m.id,
    leadId: m.leadId,
    leadName: m.leadName,
    leadCompany: m.leadCompany,
    scheduledAt: m.scheduledAt.toISOString(),
    purpose: m.purpose,
    status: m.status,
    emailSubject: m.emailSubject,
    emailBody: m.emailBody,
    prepNotes: m.prepNotes,
    meetingNotes: m.meetingNotes,
    createdAt: m.createdAt.toISOString(),
  };
}

function formatTask(t: typeof tasksTable.$inferSelect) {
  return {
    id: t.id,
    meetingId: t.meetingId,
    description: t.description,
    completed: t.completed,
    createdAt: t.createdAt.toISOString(),
  };
}

router.get("/meetings", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const meetings = await db
    .select()
    .from(meetingsTable)
    .where(eq(meetingsTable.userId, req.user.id))
    .orderBy(meetingsTable.scheduledAt);

  res.json({ meetings: meetings.map(formatMeeting) });
});

router.post("/meetings", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = CreateMeetingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const [meeting] = await db
    .insert(meetingsTable)
    .values({
      ...parsed.data,
      userId: req.user.id,
      scheduledAt: new Date(parsed.data.scheduledAt),
    })
    .returning();

  res.status(201).json(formatMeeting(meeting));
});

router.get("/meetings/:id/tasks", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const meetingId = req.params.id as string;
  const tasks = await db
    .select()
    .from(tasksTable)
    .where(
      and(
        eq(tasksTable.meetingId, meetingId),
        eq(tasksTable.userId, req.user.id),
      ),
    )
    .orderBy(tasksTable.createdAt);

  res.json({ tasks: tasks.map(formatTask) });
});

router.post("/meetings/:id/tasks", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const taskMeetingId = req.params.id as string;
  const [task] = await db
    .insert(tasksTable)
    .values({
      ...parsed.data,
      meetingId: taskMeetingId,
      userId: req.user.id,
    })
    .returning();

  res.status(201).json(formatTask(task));
});

router.patch("/tasks/:id/complete", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const taskId = req.params.id as string;
  const [task] = await db
    .update(tasksTable)
    .set({ completed: true })
    .where(
      and(
        eq(tasksTable.id, taskId),
        eq(tasksTable.userId, req.user.id),
      ),
    )
    .returning();

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json(formatTask(task));
});

export default router;
