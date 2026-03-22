export interface Deal {
  id?: string;
  name: string;
  color: string;
  company?: string;
  keywords?: string[];
  sort_order?: number;
}

export interface Task {
  id: string;
  text: string;
  deal: string;
  priority: "high" | "medium" | "low";
  deadline: string | null;
  assignee: string | null;
  done: boolean;
  synced?: boolean;
  calendar_event_id?: string | null;
  source?: string;
  source_email_id?: string | null;
  created_at?: string;
  completed_at?: string | null;
}

export interface CalendarEvent {
  title: string;
  start: string;
  end: string;
  date: string;
  location: string | null;
  deal?: string | null;
  context?: string | null;
  agenda?: string[] | null;
  documents?: string[] | null;
  attendees?: string[];
}

export interface EmailSuggestion {
  text: string;
  deal: string | null;
  priority: "high" | "medium" | "low";
  deadline: string | null;
  assignee: string | null;
  source: string;
}

export interface StatusMessage {
  type: "info" | "ok" | "error";
  text: string;
}

export interface CompletionSuggestion {
  taskId: string;
  taskText: string;
  reason: string;
}

export interface MeetingPrepSuggestion {
  meetingTitle: string;
  text: string;
  deal: string | null;
  priority: "high" | "medium";
  deadline: string | null;
  source: string;
}

export type ViewType = "focus" | "all" | "week" | "team" | "recap";
