import { Badge } from "@/components/ui/badge";
import type { ClubMember } from "@/features/clubs/types/club";

type ClubMemberListProps = {
  members: ClubMember[];
};

const roleLabelMap: Record<string, string> = {
  owner: "방장",
  manager: "매니저",
  member: "멤버",
};

export function ClubMemberList({ members }: ClubMemberListProps) {
  return (
    <div className="grid gap-2">
      {members.map((member) => (
        <div
          key={member.id}
          className="flex items-center justify-between rounded-lg border bg-card px-3 py-2.5"
        >
          <span className="text-sm font-medium">{member.nickname}</span>
          <Badge variant={member.role === "owner" ? "brand" : "default"}>
            {roleLabelMap[member.role] ?? member.role}
          </Badge>
        </div>
      ))}
    </div>
  );
}
