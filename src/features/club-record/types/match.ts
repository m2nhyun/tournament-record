export type ClubRecordMatchStatus =
  | "pending_result"
  | "confirmed"
  | "cancelled";

export type ClubRecordAssignmentMode = "auto" | "manual";

export type ClubRecordMatchPlayer = {
  participantId: string;
  side: 1 | 2;
  position: 1 | 2;
};

export type ClubRecordMatch = {
  id: string;
  eventId: string;
  slotId: string;
  status: ClubRecordMatchStatus;
  assignmentMode: ClubRecordAssignmentMode;
  isManual: boolean;
  players: ClubRecordMatchPlayer[];
  confirmedAt: string | null;
};

export type ClubRecordMatchResult = {
  matchId: string;
  scoreText: string;
  isDraw: boolean;
  winningSide: 1 | 2 | null;
  losingSide: 1 | 2 | null;
  enteredAt: string;
};

export type ClubRecordManualMatchInput = {
  slotId: string;
  players: ClubRecordMatchPlayer[];
};

export type ClubRecordResultInput = {
  scoreText: string;
};
