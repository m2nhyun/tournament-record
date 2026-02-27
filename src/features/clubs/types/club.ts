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
