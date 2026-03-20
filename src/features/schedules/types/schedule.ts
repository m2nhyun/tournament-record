export type MatchScheduleFormat =
  | "men_doubles"
  | "women_doubles"
  | "open_doubles";

export type MatchScheduleStatus = "open" | "full" | "cancelled";

export type MatchScheduleCreationData = {
  format: MatchScheduleFormat;
  scheduledAt: string;
  endsAt: string;
  location: string;
  courtFee: number;
  ballFee: number;
  capacity: number;
  includeHost: boolean;
  notes: string;
};

export type MatchScheduleParticipant = {
  clubMemberId: string;
  nickname: string;
  joinedAt: string;
  isHost: boolean;
  isMe: boolean;
};

export type MatchScheduleSummary = {
  id: string;
  clubId: string;
  format: MatchScheduleFormat;
  status: MatchScheduleStatus;
  scheduledAt: string;
  endsAt: string;
  location: string;
  courtFee: number;
  ballFee: number;
  capacity: number;
  notes: string;
  hostMemberId: string;
  hostNickname: string;
  hostParticipates: boolean;
  participantCount: number;
  remainingSlots: number;
  isHost: boolean;
  isParticipant: boolean;
  participants: MatchScheduleParticipant[];
};

export type MatchScheduleDetail = MatchScheduleSummary & {
  linkedMatchId: string | null;
  estimatedFeePerPerson: number;
};
