export type ClubRole = "owner" | "manager" | "member";

export type ClubSummary = {
  id: string;
  name: string;
  inviteCode: string;
  role: ClubRole;
  nickname: string;
  createdAt: string;
};

export type ClubTab = "list" | "join" | "create";

export type ClubDetail = {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
  myRole: ClubRole;
  myNickname: string;
};

export type ClubMember = {
  id: string;
  userId: string;
  nickname: string;
  role: ClubRole;
  createdAt: string;
  isMe: boolean;
  openKakaoProfile: boolean;
  allowRecordSearch: boolean;
  shareHistory: boolean;
};
