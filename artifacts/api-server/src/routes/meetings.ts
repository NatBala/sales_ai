import { Router, type IRouter, type Request, type Response } from "express";
import { CreateMeetingBody, CreateTaskBody } from "@workspace/api-zod";

const router: IRouter = Router();
const DEMO_USER_ID = "demo-user";

// In-memory store (used when DB is unavailable)
interface StoredMeeting {
  id: string;
  userId: string;
  leadId: string;
  leadName: string;
  leadCompany: string;
  scheduledAt: Date;
  purpose: string;
  status: string;
  emailSubject: string | null;
  emailBody: string | null;
  prepNotes: string | null;
  meetingNotes: string | null;
  createdAt: Date;
}

interface StoredTask {
  id: string;
  meetingId: string;
  userId: string;
  description: string;
  completed: boolean;
  createdAt: Date;
}

let useDb = true;
let db: any;
let meetingsTable: any;
let tasksTable: any;
let eq: any;
let and: any;

try {
  const dbMod = await import("@workspace/db");
  const ormMod = await import("drizzle-orm");
  db = dbMod.db;
  meetingsTable = dbMod.meetingsTable;
  tasksTable = dbMod.tasksTable;
  eq = ormMod.eq;
  and = ormMod.and;
} catch {
  useDb = false;
}

const inMemoryMeetings: StoredMeeting[] = [];
const inMemoryTasks: StoredTask[] = [];

function serializeMeeting(m: StoredMeeting) {
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

function serializeTask(t: StoredTask) {
  return {
    id: t.id,
    meetingId: t.meetingId,
    description: t.description,
    completed: t.completed,
    createdAt: t.createdAt.toISOString(),
  };
}

router.get("/meetings", async (_req: Request, res: Response) => {
  if (useDb) {
    try {
      const meetings = await db
        .select()
        .from(meetingsTable)
        .where(eq(meetingsTable.userId, DEMO_USER_ID))
        .orderBy(meetingsTable.scheduledAt);
      res.json({ meetings: meetings.map(serializeMeeting) });
      return;
    } catch {
      // DB unavailable, fall through to in-memory
    }
  }
  const sorted = [...inMemoryMeetings]
    .filter((m) => m.userId === DEMO_USER_ID)
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  res.json({ meetings: sorted.map(serializeMeeting) });
});

router.post("/meetings", async (req: Request, res: Response) => {
  const parsed = CreateMeetingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  if (useDb) {
    try {
      const [meeting] = await db
        .insert(meetingsTable)
        .values({
          ...parsed.data,
          userId: DEMO_USER_ID,
          scheduledAt: new Date(parsed.data.scheduledAt),
        })
        .returning();
      res.status(201).json(serializeMeeting(meeting));
      return;
    } catch {
      // DB unavailable, fall through to in-memory
    }
  }

  const meeting: StoredMeeting = {
    id: crypto.randomUUID(),
    userId: DEMO_USER_ID,
    leadId: parsed.data.leadId,
    leadName: parsed.data.leadName,
    leadCompany: parsed.data.leadCompany,
    scheduledAt: new Date(parsed.data.scheduledAt),
    purpose: parsed.data.purpose,
    status: "scheduled",
    emailSubject: parsed.data.emailSubject ?? null,
    emailBody: parsed.data.emailBody ?? null,
    prepNotes: null,
    meetingNotes: null,
    createdAt: new Date(),
  };
  inMemoryMeetings.push(meeting);
  res.status(201).json(serializeMeeting(meeting));
});

router.get("/meetings/:id/tasks", async (req: Request, res: Response) => {
  const meetingId = req.params.id as string;

  if (useDb) {
    try {
      const tasks = await db
        .select()
        .from(tasksTable)
        .where(
          and(
            eq(tasksTable.meetingId, meetingId),
            eq(tasksTable.userId, DEMO_USER_ID),
          ),
        )
        .orderBy(tasksTable.createdAt);
      res.json({ tasks: tasks.map(serializeTask) });
      return;
    } catch {
      // DB unavailable, fall through to in-memory
    }
  }

  const tasks = inMemoryTasks
    .filter((t) => t.meetingId === meetingId && t.userId === DEMO_USER_ID)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  res.json({ tasks: tasks.map(serializeTask) });
});

router.post("/meetings/:id/tasks", async (req: Request, res: Response) => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const taskMeetingId = req.params.id as string;

  if (useDb) {
    try {
      const [meeting] = await db
        .select({ id: meetingsTable.id })
        .from(meetingsTable)
        .where(and(eq(meetingsTable.id, taskMeetingId), eq(meetingsTable.userId, DEMO_USER_ID)));

      if (!meeting) {
        res.status(404).json({ error: "Meeting not found" });
        return;
      }

      const [task] = await db
        .insert(tasksTable)
        .values({
          ...parsed.data,
          meetingId: taskMeetingId,
          userId: DEMO_USER_ID,
        })
        .returning();
      res.status(201).json(serializeTask(task));
      return;
    } catch {
      // DB unavailable, fall through to in-memory
    }
  }

  const meeting = inMemoryMeetings.find((m) => m.id === taskMeetingId && m.userId === DEMO_USER_ID);
  if (!meeting) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }

  const task: StoredTask = {
    id: crypto.randomUUID(),
    meetingId: taskMeetingId,
    userId: DEMO_USER_ID,
    description: parsed.data.description,
    completed: false,
    createdAt: new Date(),
  };
  inMemoryTasks.push(task);
  res.status(201).json(serializeTask(task));
});

router.patch("/tasks/:id/complete", async (req: Request, res: Response) => {
  const taskId = req.params.id as string;

  if (useDb) {
    try {
      const [task] = await db
        .update(tasksTable)
        .set({ completed: true })
        .where(
          and(
            eq(tasksTable.id, taskId),
            eq(tasksTable.userId, DEMO_USER_ID),
          ),
        )
        .returning();

      if (!task) {
        res.status(404).json({ error: "Task not found" });
        return;
      }
      res.json(serializeTask(task));
      return;
    } catch {
      // DB unavailable, fall through to in-memory
    }
  }

  const task = inMemoryTasks.find((t) => t.id === taskId && t.userId === DEMO_USER_ID);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  task.completed = true;
  res.json(serializeTask(task));
});

export default router;
