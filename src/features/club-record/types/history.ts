export type ClubRecordHistoryEntry = {
  matchId: string;
  eventId: string;
  eventDate: string;
  scoreText: string;
  result: "win" | "loss" | "draw";
  partnerNames: string[];
  opponentNames: string[];
};

export type ClubRecordMonthlyCardEntry = {
  clubMemberId: string;
  nickname: string;
  wins: number;
  losses: number;
  draws: number;
  /** Percentage on a 0..100 scale from get_club_record_monthly_public_card. */
  winRate: number;
};
