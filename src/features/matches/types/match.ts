export type MatchType = "singles" | "doubles";

export type MatchStatus = "draft" | "submitted" | "confirmed" | "disputed";

export type SetScore = {
  set: number;
  side1: number;
  side2: number;
  gamesToWin?: 4 | 6;
  side1Point?: "0" | "15" | "30" | "40" | "AD";
  side2Point?: "0" | "15" | "30" | "40" | "AD";
};

export type PlayerAssignment = {
  clubMemberId: string;
  nickname: string;
  side: 1 | 2;
  position: 1 | 2;
};

export type MatchCreationData = {
  matchType: MatchType;
  playedAt: string;
  players: PlayerAssignment[];
  setScores: SetScore[];
};

export type MatchSummary = {
  id: string;
  clubId: string;
  matchType: MatchType;
  status: MatchStatus;
  playedAt: string;
  scoreSummary: string;
  side1Players: string[];
  side2Players: string[];
  createdAt: string;
};

export type MatchDetail = {
  id: string;
  clubId: string;
  matchType: MatchType;
  status: MatchStatus;
  playedAt: string;
  createdBy: string;
  createdAt: string;
  result: {
    scoreSummary: string;
    setScores: SetScore[];
    submittedBy: string;
  } | null;
  players: {
    side: 1 | 2;
    position: number;
    nickname: string;
    clubMemberId: string;
  }[];
};
