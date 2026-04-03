// Shared in-memory store — single source of truth used by both route handlers and reset endpoints

export interface StoredLead {
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

export interface StoredMeeting {
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

export interface StoredTask {
  id: string;
  meetingId: string;
  userId: string;
  description: string;
  completed: boolean;
  createdAt: Date;
}

export const inMemoryLeads: StoredLead[] = [];
export const inMemoryMeetings: StoredMeeting[] = [];
export const inMemoryTasks: StoredTask[] = [];

export function clearAllInMemory() {
  inMemoryLeads.length = 0;
  inMemoryMeetings.length = 0;
  inMemoryTasks.length = 0;
}
