import { openai } from "@workspace/integrations-openai-ai-server";
import { db, pool, leadsTable, meetingsTable, tasksTable } from "@workspace/db";
import type { Lead, Meeting } from "@workspace/db";

const DEMO_USER_ID = "demo-user";

function parseJson(content: string): Record<string, unknown> {
  const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) ?? content.match(/(\{[\s\S]*\})/);
  const raw = jsonMatch ? jsonMatch[1] : content;
  try {
    const parsed: unknown = JSON.parse(raw.trim());
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

async function chat(prompt: string): Promise<Record<string, unknown>> {
  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: "You are a helpful data generator. Always respond with valid JSON only, no markdown." },
      { role: "user", content: prompt },
    ],
  });
  return parseJson(response.choices[0]?.message?.content ?? "{}");
}

async function generateLeads() {
  console.log("Generating leads with AI...");
  const data = await chat(`
Generate 10 realistic financial services sales leads with varied profiles. Return JSON:
{
  "leads": [
    {
      "name": "Full Name",
      "company": "Company Name",
      "title": "Job Title",
      "score": 88,
      "reason": "Brief 1-2 sentence fit reason",
      "assets": "2-3 sentences about their portfolio, AUM, and investment style",
      "sales": "2-3 sentences about relationship history or potential",
      "reasoning": "3-4 sentences of detailed AI reasoning for why they are a great prospect",
      "email": "professional@company.com",
      "phone": "+1 (555) 000-0000",
      "linkedIn": "https://linkedin.com/in/name",
      "location": "City, State",
      "industry": "Industry Sector",
      "aum": "$250M AUM"
    }
  ]
}

Make them diverse: hedge fund managers, family office directors, pension fund CIOs, endowment managers, wealth advisors.
Scores should range from 72-97. Some should not have phone numbers or LinkedIn (set to null).
`);

  const leads = data.leads as Array<Record<string, unknown>>;
  if (!Array.isArray(leads) || leads.length === 0) throw new Error("No leads returned");

  const inserted: Lead[] = [];
  for (const lead of leads) {
    const [row] = await db.insert(leadsTable).values({
      userId: DEMO_USER_ID,
      name: String(lead.name ?? "Unknown"),
      company: String(lead.company ?? "Unknown"),
      title: String(lead.title ?? "Unknown"),
      score: Number(lead.score ?? 75),
      reason: String(lead.reason ?? ""),
      assets: String(lead.assets ?? ""),
      sales: String(lead.sales ?? ""),
      reasoning: String(lead.reasoning ?? ""),
      email: lead.email ? String(lead.email) : null,
      phone: lead.phone ? String(lead.phone) : null,
      linkedIn: lead.linkedIn ? String(lead.linkedIn) : null,
      location: lead.location ? String(lead.location) : null,
      industry: lead.industry ? String(lead.industry) : null,
      aum: lead.aum ? String(lead.aum) : null,
    }).returning();
    inserted.push(row);
    process.stdout.write(".");
  }
  console.log(`\nInserted ${inserted.length} leads`);
  return inserted;
}

async function generateMeetingsForLeads(leads: Lead[]) {
  console.log("Generating meetings with AI...");

  const meetingLeads = leads.slice(0, 6);

  const data = await chat(`
Generate ${meetingLeads.length} realistic sales meeting records for these financial services leads.
Leads: ${JSON.stringify(meetingLeads.map(l => ({ name: l.name, company: l.company, title: l.title })))}

Return JSON:
{
  "meetings": [
    {
      "leadIndex": 0,
      "purpose": "Initial discovery call to explore portfolio optimization needs",
      "status": "completed",
      "scheduledDaysAgo": 14,
      "emailSubject": "Compelling outreach email subject",
      "emailBody": "Full personalized outreach email body (150-200 words)",
      "prepNotes": "{\"agenda\":[\"Introductions\",\"Portfolio review\"],\"talkingPoints\":[\"Diversification strategy\"],\"clientBackground\":\"Background here\",\"keyObjections\":[\"Objection 1\"]}",
      "meetingNotes": "Detailed 3-4 paragraph meeting notes covering what was discussed, client concerns, decisions made, and agreed next steps"
    }
  ]
}

Meeting statuses: first 2 should be "scheduled" (scheduledDaysAgo: -7 and -3 for future dates), 
next 2 "in_progress" (scheduledDaysAgo: 0), 
last 2 "completed" (scheduledDaysAgo: 10 and 21).
Make purposes vary: discovery call, portfolio review, product presentation, quarterly check-in, proposal review.
`);

  const meetings = data.meetings as Array<Record<string, unknown>>;
  if (!Array.isArray(meetings) || meetings.length === 0) throw new Error("No meetings returned");

  const inserted: Meeting[] = [];
  for (const meeting of meetings) {
    const leadIndex = Number(meeting.leadIndex ?? 0);
    const lead = meetingLeads[leadIndex] ?? meetingLeads[0];
    const daysAgo = Number(meeting.scheduledDaysAgo ?? 0);
    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() - daysAgo);

    const [row] = await db.insert(meetingsTable).values({
      userId: DEMO_USER_ID,
      leadId: lead.id,
      leadName: lead.name,
      leadCompany: lead.company,
      scheduledAt,
      purpose: String(meeting.purpose ?? "Discovery call"),
      status: String(meeting.status ?? "scheduled"),
      emailSubject: meeting.emailSubject ? String(meeting.emailSubject) : null,
      emailBody: meeting.emailBody ? String(meeting.emailBody) : null,
      prepNotes: meeting.prepNotes ? String(meeting.prepNotes) : null,
      meetingNotes: meeting.meetingNotes ? String(meeting.meetingNotes) : null,
    }).returning();
    inserted.push(row);
    process.stdout.write(".");
  }
  console.log(`\nInserted ${inserted.length} meetings`);
  return inserted;
}

async function generateTasksForMeetings(meetings: Meeting[]) {
  console.log("Generating follow-up tasks with AI...");

  const completedMeetings = meetings.filter(m => m.status === "completed");
  let taskCount = 0;

  for (const meeting of completedMeetings) {
    const data = await chat(`
Generate 4-6 specific post-meeting follow-up tasks for this completed sales meeting.
Client: ${meeting.leadName} at ${meeting.leadCompany}
Purpose: ${meeting.purpose}
Meeting Notes: ${meeting.meetingNotes ?? "Productive discovery call. Client expressed interest in portfolio optimization."}

Return JSON:
{
  "tasks": [
    { "description": "Action item starting with a verb", "completed": false },
    { "description": "Another specific task", "completed": true }
  ]
}

Mix completed (true) and pending (false) tasks. Make tasks specific and realistic.
Examples: "Send quarterly report to...", "Schedule follow-up call for...", "Prepare custom proposal for...", "Share research on..."
`);

    const tasks = data.tasks as Array<{ description: string; completed: boolean }>;
    if (!Array.isArray(tasks)) continue;

    for (const task of tasks) {
      await db.insert(tasksTable).values({
        meetingId: meeting.id,
        userId: DEMO_USER_ID,
        description: String(task.description ?? "Follow up with client"),
        completed: Boolean(task.completed ?? false),
      });
      taskCount++;
      process.stdout.write(".");
    }
  }
  console.log(`\nInserted ${taskCount} tasks for ${completedMeetings.length} completed meetings`);
}

async function clearExistingData() {
  console.log("Clearing existing demo data...");
  await db.delete(tasksTable);
  await db.delete(meetingsTable);
  await db.delete(leadsTable);
  console.log("Cleared.");
}

async function main() {
  console.log("Sales AI Hub — Synthetic Data Seeder");
  console.log("=====================================");

  await clearExistingData();
  const leads = await generateLeads();
  const meetings = await generateMeetingsForLeads(leads);
  await generateTasksForMeetings(meetings);

  console.log("\nSeed complete! Summary:");
  console.log(`  Leads:    ${leads.length}`);
  console.log(`  Meetings: ${meetings.length}`);
  console.log(`  Statuses: ${meetings.filter(m => m.status === "scheduled").length} scheduled, ${meetings.filter(m => m.status === "in_progress").length} in-progress, ${meetings.filter(m => m.status === "completed").length} completed`);

  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
