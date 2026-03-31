import { Router, type IRouter, type Request, type Response } from "express";
import { CreateLeadBody } from "@workspace/api-zod";

const router: IRouter = Router();
const DEMO_USER_ID = "demo-user";

// In-memory store (used when DB is unavailable; also serves as fast fallback)
interface StoredLead {
  id: string;
  userId: string;
  name: string;
  company: string;
  title: string;
  score: number;
  reason: string;
  assets: string;
  sales: string;
  reasoning: string;
  email: string | null;
  phone: string | null;
  linkedIn: string | null;
  location: string | null;
  industry: string | null;
  aum: string | null;
  createdAt: Date;
}

let useDb = true;
let db: any;
let leadsTable: any;
let eq: any;
let and: any;

try {
  const dbMod = await import("@workspace/db");
  const ormMod = await import("drizzle-orm");
  db = dbMod.db;
  leadsTable = dbMod.leadsTable;
  eq = ormMod.eq;
  and = ormMod.and;
} catch {
  useDb = false;
}

const inMemoryLeads: StoredLead[] = [];

function serializeLead(l: StoredLead) {
  return {
    id: l.id,
    name: l.name,
    company: l.company,
    title: l.title,
    score: l.score,
    reason: l.reason,
    assets: l.assets,
    sales: l.sales,
    reasoning: l.reasoning,
    email: l.email,
    phone: l.phone,
    linkedIn: l.linkedIn,
    location: l.location,
    industry: l.industry,
    aum: l.aum,
    createdAt: l.createdAt.toISOString(),
  };
}

router.get("/leads", async (_req: Request, res: Response) => {
  if (useDb) {
    try {
      const leads = await db
        .select()
        .from(leadsTable)
        .where(eq(leadsTable.userId, DEMO_USER_ID))
        .orderBy(leadsTable.createdAt);
      res.json({ leads: leads.map(serializeLead) });
      return;
    } catch {
      // DB unavailable, fall through to in-memory
    }
  }
  res.json({ leads: inMemoryLeads.map(serializeLead) });
});

router.post("/leads", async (req: Request, res: Response) => {
  const parsed = CreateLeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  if (useDb) {
    try {
      const [lead] = await db
        .insert(leadsTable)
        .values({ ...parsed.data, userId: DEMO_USER_ID })
        .returning();
      res.status(201).json(serializeLead(lead));
      return;
    } catch {
      // DB unavailable, fall through to in-memory
    }
  }

  const lead: StoredLead = {
    id: crypto.randomUUID(),
    userId: DEMO_USER_ID,
    ...parsed.data,
    email: parsed.data.email ?? null,
    phone: parsed.data.phone ?? null,
    linkedIn: parsed.data.linkedIn ?? null,
    location: parsed.data.location ?? null,
    industry: parsed.data.industry ?? null,
    aum: parsed.data.aum ?? null,
    createdAt: new Date(),
  };
  inMemoryLeads.push(lead);
  res.status(201).json(serializeLead(lead));
});

router.get("/leads/:id", async (req: Request, res: Response) => {
  const leadId = req.params.id as string;

  if (useDb) {
    try {
      const [lead] = await db
        .select()
        .from(leadsTable)
        .where(and(eq(leadsTable.id, leadId), eq(leadsTable.userId, DEMO_USER_ID)));
      if (!lead) {
        res.status(404).json({ error: "Lead not found" });
        return;
      }
      res.json(serializeLead(lead));
      return;
    } catch {
      // DB unavailable, fall through to in-memory
    }
  }

  const lead = inMemoryLeads.find((l) => l.id === leadId);
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  res.json(serializeLead(lead));
});

export default router;
