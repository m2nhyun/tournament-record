export type ClubRecordSettings = {
  clubId: string;
  groupAPercent: number;
  groupBPercent: number;
  groupCPercent: number;
  updatedAt: string;
};

export type ClubRecordSettingsUpdateInput = {
  groupAPercent: number;
  groupBPercent: number;
  groupCPercent: number;
};
