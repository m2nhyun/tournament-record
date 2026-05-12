export type ClubRecordEventStatus =
  | "draft"
  | "open"
  | "in_progress"
  | "completed"
  | "cancelled";

export type ClubRecordEvent = {
  id: string;
  clubId: string;
  title: string | null;
  eventDate: string;
  startsAt: string;
  endsAt: string;
  courtCount: number;
  status: ClubRecordEventStatus;
  assignmentDirty: boolean;
  lastAssignmentRunAt: string | null;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ClubRecordEventCreateInput = {
  title?: string;
  eventDate: string;
  startsAt: string;
  endsAt: string;
  courtCount: number;
};

export type ClubRecordEventUpdateInput = Partial<ClubRecordEventCreateInput>;
