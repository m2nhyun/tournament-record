"use client";

import { ClubTabs } from "@/features/clubs/components/club-tabs";
import { ClubList } from "@/features/clubs/components/club-list";
import { CreateClubForm } from "@/features/clubs/components/create-club-form";
import { JoinClubForm } from "@/features/clubs/components/join-club-form";
import { AuthGate } from "@/features/clubs/components/auth-gate";
import { useClubDashboard } from "@/features/clubs/hooks/use-club-dashboard";
import { LoadingSpinner } from "@/components/feedback/loading-spinner";
import { StatusBox } from "@/components/feedback/status-box";
import { Button } from "@/components/ui/button";

export function ClubDashboard() {
  const {
    user,
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
    beginKakaoSignIn,
    beginEmailSignIn,
    beginEmailSignUp,
    logout,
    email,
    setEmail,
    password,
    setPassword,
    isGuestModeEnabled,
    isAnonymousUser,
  } = useClubDashboard();

  if (busyType === "loading") {
    return (
      <div className="flex min-h-[calc(100dvh-9rem)] items-center justify-center">
        <LoadingSpinner message="세션 확인 중..." />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <header className="space-y-1">
        <div className={user ? "flex items-start justify-between gap-3" : "text-center"}>
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">Tournament Record</h1>
            <p className="text-lg text-muted-foreground">아마추어 테니스 경기 기록 관리</p>
          </div>
          {user ? (
            <Button size="sm" variant="outline" onClick={() => void logout()}>
              로그아웃
            </Button>
          ) : null}
        </div>
      </header>

      <StatusBox type={status.type} message={status.message} />

      {!user ? (
        <AuthGate
          loading={busyType === "auth"}
          email={email}
          password={password}
          guestMode={isGuestModeEnabled}
          onChangeEmail={setEmail}
          onChangePassword={setPassword}
          onKakaoSignIn={beginKakaoSignIn}
          onEmailSignIn={beginEmailSignIn}
          onEmailSignUp={beginEmailSignUp}
        />
      ) : null}

      {user ? (
        <ClubTabs
          activeTab={activeTab}
          onChange={setActiveTab}
          canCreateClub={!isAnonymousUser}
        />
      ) : null}

      {user && activeTab === "list" ? (
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">내 클럽 목록</h2>
          <ClubList clubs={clubs} onMoveJoin={() => setActiveTab("join")} />
        </section>
      ) : null}

      {user && activeTab === "join" ? (
        <JoinClubForm
          inviteCode={joinCode}
          nickname={joinNickname}
          isSubmitting={busyType === "join"}
          onChangeInviteCode={setJoinCode}
          onChangeNickname={setJoinNickname}
          onSubmit={submitJoinClub}
        />
      ) : null}

      {user && !isAnonymousUser && activeTab === "create" ? (
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
