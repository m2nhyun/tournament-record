import type { ClubRecordAccessContext } from "@/features/club-record/types/access";
import type { ClubRecordEvent } from "@/features/club-record/types/event";
import type { ClubRecordMonthlyCardEntry } from "@/features/club-record/types/history";

export type ClubRecordDashboardEventSummary = {
  id: string;
  title: string | null;
  eventDate: string;
  startsAt: string;
  endsAt: string;
  status: ClubRecordEvent["status"];
  assignmentDirty: boolean;
  lastAssignmentRunAt: string | null;
};

export type ClubRecordDashboardNextMatch = {
  matchId: string;
  eventId: string;
  eventTitle: string | null;
  slotStartsAt: string;
  slotEndsAt: string;
  courtNumber: number;
  mySide: 1 | 2;
  teamOneNames: string[];
  teamTwoNames: string[];
};

export type ClubRecordDashboardData = {
  access: ClubRecordAccessContext;
  currentEvent: ClubRecordDashboardEventSummary | null;
  upcomingEvents: ClubRecordDashboardEventSummary[];
  monthlyCard: ClubRecordMonthlyCardEntry[];
  monthStart: string;
  nextMatch: ClubRecordDashboardNextMatch | null;
};
