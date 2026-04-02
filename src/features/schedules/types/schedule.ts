export type MatchScheduleFormat =
  | "men_doubles"
  | "women_doubles"
  | "open_doubles";

export type MatchScheduleStatus = "open" | "reviewing" | "full" | "cancelled";
export type MatchScheduleJoinPolicy = "instant" | "approval_required";
export type MatchScheduleRequestStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled_by_user";

export type MatchScheduleCreationData = {
  format: MatchScheduleFormat;
  joinPolicy: MatchScheduleJoinPolicy;
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

export type MatchScheduleRequest = {
  clubMemberId: string;
  nickname: string;
  requestedAt: string;
  status: MatchScheduleRequestStatus;
  message: string;
  isMe: boolean;
};

export type MatchScheduleSummary = {
  id: string;
  clubId: string;
  format: MatchScheduleFormat;
  status: MatchScheduleStatus;
  joinPolicy: MatchScheduleJoinPolicy;
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
  myRequestStatus: MatchScheduleRequestStatus | null;
  requestCount: number;
  participants: MatchScheduleParticipant[];
};

export type MatchScheduleDetail = MatchScheduleSummary & {
  linkedMatchId: string | null;
  estimatedFeePerPerson: number;
  pendingRequests: MatchScheduleRequest[];
};
