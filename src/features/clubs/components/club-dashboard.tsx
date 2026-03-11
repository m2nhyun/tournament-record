"use client";

import { AnimatePresence, motion } from "framer-motion";

import { ClubTabs } from "@/features/clubs/components/club-tabs";
import { ClubList } from "@/features/clubs/components/club-list";
import { CreateClubForm } from "@/features/clubs/components/create-club-form";
import { JoinClubForm } from "@/features/clubs/components/join-club-form";
import { AuthGate } from "@/features/clubs/components/auth-gate";
import { useClubDashboard } from "@/features/clubs/hooks/use-club-dashboard";
import { LoadingSpinner } from "@/components/feedback/loading-spinner";
import { StatusBox } from "@/components/feedback/status-box";
import { Button } from "@/components/ui/button";
import { AppBar } from "@/components/layout/app-bar";

function tabTitle(activeTab: "list" | "join" | "create") {
  if (activeTab === "join") return "클럽 참가";
  if (activeTab === "create") return "클럽 만들기";
  return "내 클럽";
}

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
    return <LoadingSpinner title="로딩 중" message="세션 확인 중..." />;
  }

  return (
    <div className="w-full max-w-2xl">
      <AppBar
        title={user ? tabTitle(activeTab) : "시작하기"}
        actions={
          user ? (
            <Button size="sm" variant="outline" onClick={() => void logout()}>
              로그아웃
            </Button>
          ) : null
        }
        showBack={false}
      />
      <div className="px-4">
        <div className="space-y-6 pt-4">
          <StatusBox type={status.type} message={status.message} />

          {!user ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
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
            </motion.div>
          ) : null}

          {user ? (
            <ClubTabs
              activeTab={activeTab}
              onChange={setActiveTab}
              canCreateClub={!isAnonymousUser}
            />
          ) : null}

          <AnimatePresence mode="wait" initial={false}>
            {user && activeTab === "list" ? (
              <motion.section
                key="tab-list"
                className="space-y-3"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                <ClubList
                  clubs={clubs}
                  onMoveJoin={() => setActiveTab("join")}
                  onMoveCreate={() => setActiveTab("create")}
                  canCreateClub={!isAnonymousUser}
                />
              </motion.section>
            ) : null}

            {user && activeTab === "join" ? (
              <motion.div
                key="tab-join"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                <JoinClubForm
                  inviteCode={joinCode}
                  nickname={joinNickname}
                  isSubmitting={busyType === "join"}
                  onChangeInviteCode={setJoinCode}
                  onChangeNickname={setJoinNickname}
                  onSubmit={submitJoinClub}
                />
              </motion.div>
            ) : null}

            {user && !isAnonymousUser && activeTab === "create" ? (
              <motion.div
                key="tab-create"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                <CreateClubForm
                  name={createName}
                  nickname={createNickname}
                  isSubmitting={busyType === "create"}
                  onChangeName={setCreateName}
                  onChangeNickname={setCreateNickname}
                  onSubmit={submitCreateClub}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
