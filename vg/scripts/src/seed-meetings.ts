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

async function main() {
  console.log("Seeding meetings and tasks...");

  // Get existing leads
  const leads = await db.select().from(leadsTable);
  console.log(`Found ${leads.length} leads`);
  if (leads.length === 0) {
    console.error("No leads found! Run the main seed script first.");
    process.exit(1);
  }

  // Clear existing meetings and tasks
  await db.delete(tasksTable);
  await db.delete(meetingsTable);
  console.log("Cleared meetings and tasks.");

  const meetingLeads = leads.slice(0, 6);

  // Generate all 6 meetings in one call
  const data = await chat(`
Generate exactly 6 realistic sales meeting records for these financial services leads.
Leads: ${JSON.stringify(meetingLeads.map((l: Lead, i: number) => ({ index: i, name: l.name, company: l.company, title: l.title })))}

Return JSON with exactly 6 meetings:
{
  "meetings": [
    {
      "leadIndex": 0,
      "purpose": "Initial discovery call to explore portfolio optimization",
      "status": "scheduled",
      "scheduledDaysAgo": -7,
      "emailSubject": "Partnership opportunity for Bridgewater's alternative allocation",
      "emailBody": "Dear [Name], I've been following Bridgewater's recent macro positioning... [150 words]",
      "prepNotes": "Agenda: intro, portfolio review, product fit. Talking points: risk-adjusted returns, downside protection. Client background: $150B AUM. Objections: current manager relationships.",
      "meetingNotes": null
    }
  ]
}

IMPORTANT - Use this exact status distribution:
- leadIndex 0: status="scheduled", scheduledDaysAgo=-7 (future)
- leadIndex 1: status="scheduled", scheduledDaysAgo=-3 (future)  
- leadIndex 2: status="in_progress", scheduledDaysAgo=0 (today)
- leadIndex 3: status="in_progress", scheduledDaysAgo=0 (today)
- leadIndex 4: status="completed", scheduledDaysAgo=10 (past)
- leadIndex 5: status="completed", scheduledDaysAgo=21 (past)

For completed meetings, include detailed meetingNotes (3-4 paragraphs).
For scheduled/in_progress meetings, meetingNotes should be null.
Make emailBody 150-200 words, personalized to each lead.
Make purposes vary: discovery call, portfolio review, product presentation, quarterly check-in, proposal review.
`);

  const meetings = data.meetings as Array<Record<string, unknown>>;
  if (!Array.isArray(meetings) || meetings.length === 0) {
    console.error("No meetings returned from AI");
    process.exit(1);
  }

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
    console.log(`  Added meeting: ${lead.name} — ${String(meeting.purpose).slice(0, 50)} [${meeting.status}]`);
  }

  console.log(`\nInserted ${inserted.length} meetings. Generating tasks for completed ones...`);

  // Generate tasks for completed meetings in one call
  const completedMeetings = inserted.filter(m => m.status === "completed");

  for (const meeting of completedMeetings) {
    const taskData = await chat(`
Generate 5 specific post-meeting follow-up tasks for this completed sales meeting.
Client: ${meeting.leadName} at ${meeting.leadCompany}
Purpose: ${meeting.purpose}
Notes summary: ${meeting.meetingNotes ? meeting.meetingNotes.slice(0, 300) : "Productive meeting with clear next steps agreed."}

Return JSON:
{
  "tasks": [
    { "description": "Send proposal document covering alternative investment strategies to James by Friday", "completed": false },
    { "description": "Schedule 60-minute deep dive on risk-adjusted returns for next week", "completed": true },
    { "description": "Share Q4 macro outlook report with the investment committee", "completed": false },
    { "description": "Prepare custom portfolio stress-test analysis", "completed": false },
    { "description": "Connect client with our CIO for technical questions on derivatives", "completed": true }
  ]
}

Make 2 completed=true and 3 completed=false. Each task should be specific and actionable.
`);

    const tasks = taskData.tasks as Array<{ description: string; completed: boolean }>;
    if (!Array.isArray(tasks)) continue;

    for (const task of tasks) {
      await db.insert(tasksTable).values({
        meetingId: meeting.id,
        userId: DEMO_USER_ID,
        description: String(task.description ?? "Follow up with client"),
        completed: Boolean(task.completed ?? false),
      });
    }
    console.log(`  Added ${tasks.length} tasks for ${meeting.leadName}`);
  }

  console.log("\nDone! Summary:");
  console.log(`  Meetings: ${inserted.length}`);
  console.log(`  Tasks: seeded for ${completedMeetings.length} completed meetings`);

  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
