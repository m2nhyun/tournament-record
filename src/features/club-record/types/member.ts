export type ClubRecordGroupCode = "A" | "B" | "C";

export type ClubRecordMember = {
  id: string;
  clubId: string;
  clubMemberId: string;
  nickname: string;
  rankingPosition: number;
  groupCode: ClubRecordGroupCode;
  attendanceCount: number;
  matchCount: number;
  joinedOn: string | null;
  operatorNote: string | null;
};

export type ClubRecordRankingMoveInput = {
  clubMemberId: string;
  targetPosition: number;
};
