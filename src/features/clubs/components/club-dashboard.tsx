"use client";

import { ClubTabs } from "@/features/clubs/components/club-tabs";
import { ClubList } from "@/features/clubs/components/club-list";
import { CreateClubForm } from "@/features/clubs/components/create-club-form";
import { JoinClubForm } from "@/features/clubs/components/join-club-form";
import { useClubDashboard } from "@/features/clubs/hooks/use-club-dashboard";
import { StatusBox } from "@/components/feedback/status-box";

export function ClubDashboard() {
  const {
    clubs,
    activeTab,
    setActiveTab,
    busyType,
    status,
    createName,
    setCreateName,
    createNickname,
    setCreateNickname,
    joinCode,
    setJoinCode,
    joinNickname,
    setJoinNickname,
    submitCreateClub,
    submitJoinClub,
  } = useClubDashboard();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-4xl font-semibold tracking-tight">Tournament Record</h1>
        <p className="text-lg text-muted-foreground">아마추어 테니스 경기 기록 관리</p>
      </header>

      <ClubTabs activeTab={activeTab} onChange={setActiveTab} />
      <StatusBox type={status.type} message={status.message} />

      {activeTab === "list" ? (
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">내 클럽 목록</h2>
          <ClubList clubs={clubs} onMoveJoin={() => setActiveTab("join")} />
        </section>
      ) : null}

      {activeTab === "join" ? (
        <JoinClubForm
          inviteCode={joinCode}
          nickname={joinNickname}
          isSubmitting={busyType === "join"}
          onChangeInviteCode={setJoinCode}
          onChangeNickname={setJoinNickname}
          onSubmit={submitJoinClub}
        />
      ) : null}

      {activeTab === "create" ? (
        <CreateClubForm
          name={createName}
          nickname={createNickname}
          isSubmitting={busyType === "create"}
          onChangeName={setCreateName}
          onChangeNickname={setCreateNickname}
          onSubmit={submitCreateClub}
        />
      ) : null}
    </div>
  );
}
