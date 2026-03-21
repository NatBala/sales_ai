import { Router, type IRouter, type Request, type Response } from "express";
import { db, leadsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateLeadBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/leads", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const leads = await db
    .select()
    .from(leadsTable)
    .where(eq(leadsTable.userId, req.user.id))
    .orderBy(leadsTable.createdAt);

  res.json({
    leads: leads.map((l) => ({
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
    })),
  });
});

router.post("/leads", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = CreateLeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const [lead] = await db
    .insert(leadsTable)
    .values({ ...parsed.data, userId: req.user.id })
    .returning();

  res.status(201).json({
    id: lead.id,
    name: lead.name,
    company: lead.company,
    title: lead.title,
    score: lead.score,
    reason: lead.reason,
    assets: lead.assets,
    sales: lead.sales,
    reasoning: lead.reasoning,
    email: lead.email,
    phone: lead.phone,
    linkedIn: lead.linkedIn,
    location: lead.location,
    industry: lead.industry,
    aum: lead.aum,
    createdAt: lead.createdAt.toISOString(),
  });
});

router.get("/leads/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const leadId = req.params.id as string;
  const [lead] = await db
    .select()
    .from(leadsTable)
    .where(and(eq(leadsTable.id, leadId), eq(leadsTable.userId, req.user.id)));

  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  res.json({
    id: lead.id,
    name: lead.name,
    company: lead.company,
    title: lead.title,
    score: lead.score,
    reason: lead.reason,
    assets: lead.assets,
    sales: lead.sales,
    reasoning: lead.reasoning,
    email: lead.email,
    phone: lead.phone,
    linkedIn: lead.linkedIn,
    location: lead.location,
    industry: lead.industry,
    aum: lead.aum,
    createdAt: lead.createdAt.toISOString(),
  });
});

export default router;
