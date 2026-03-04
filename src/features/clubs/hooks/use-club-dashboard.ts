import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";

import {
  createClub,
  ensureSessionUser,
  isGuestModeEnabled,
  joinClub,
  listMyClubs,
  signInWithEmail,
  signInWithKakao,
  signOut,
  signUpWithEmail,
} from "@/features/clubs/services/clubs";
import type { ClubSummary, ClubTab } from "@/features/clubs/types/club";

type BusyType = "loading" | "create" | "join" | "auth" | null;
type StatusType = "info" | "success" | "error";

type StatusState = {
  type: StatusType;
  message: string;
};

function toMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "요청 처리 중 오류가 발생했습니다.";
}

export function useClubDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [clubs, setClubs] = useState<ClubSummary[]>([]);
  const [activeTab, setActiveTab] = useState<ClubTab>("list");
  const [busyType, setBusyType] = useState<BusyType>("loading");
  const [status, setStatus] = useState<StatusState>({
    type: "info",
    message: "시작하려면 로그인하거나 게스트 모드를 사용하세요.",
  });

  const [createName, setCreateName] = useState("");
  const [createNickname, setCreateNickname] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinNickname, setJoinNickname] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const isBusy = useMemo(() => busyType !== null, [busyType]);

  const refreshClubs = useCallback(async () => {
    setBusyType("loading");
    try {
      const sessionUser = await ensureSessionUser();
      setUser(sessionUser);

      if (!sessionUser) {
        setClubs([]);
        setStatus({
          type: "info",
          message: "로그인 후 클럽을 만들거나 참가할 수 있습니다.",
        });
        return;
      }

      const nextClubs = await listMyClubs();
      setClubs(nextClubs);
      setStatus({
        type: "info",
        message:
          nextClubs.length > 0
            ? `총 ${nextClubs.length}개 클럽을 불러왔습니다.`
            : "참여 중인 클럽이 없습니다.",
      });
    } catch (error) {
      setStatus({ type: "error", message: toMessage(error) });
    } finally {
      setBusyType(null);
    }
  }, []);

  useEffect(() => {
    void refreshClubs();
  }, [refreshClubs]);

  const submitCreateClub = useCallback(async () => {
    if (!createName.trim() || !createNickname.trim()) {
      setStatus({ type: "error", message: "클럽 이름과 닉네임을 입력해주세요." });
      return;
    }

    setBusyType("create");
    try {
      const inviteCode = await createClub({ name: createName, nickname: createNickname });
      setCreateName("");
      setCreateNickname("");
      setActiveTab("list");
      setStatus({ type: "success", message: `클럽 생성 완료 · 참가 코드 ${inviteCode}` });
      await refreshClubs();
    } catch (error) {
      setStatus({ type: "error", message: toMessage(error) });
      setBusyType(null);
    }
  }, [createName, createNickname, refreshClubs]);

  const submitJoinClub = useCallback(async () => {
    if (!joinCode.trim() || !joinNickname.trim()) {
      setStatus({ type: "error", message: "참가 코드와 닉네임을 입력해주세요." });
      return;
    }

    setBusyType("join");
    try {
      await joinClub({ inviteCode: joinCode, nickname: joinNickname });
      setJoinCode("");
      setJoinNickname("");
      setActiveTab("list");
      setStatus({ type: "success", message: "클럽 참가가 완료되었습니다." });
      await refreshClubs();
    } catch (error) {
      setStatus({ type: "error", message: toMessage(error) });
      setBusyType(null);
    }
  }, [joinCode, joinNickname, refreshClubs]);

  const beginKakaoSignIn = useCallback(async () => {
    setBusyType("auth");
    try {
      await signInWithKakao();
    } catch (error) {
      setStatus({ type: "error", message: toMessage(error) });
      setBusyType(null);
    }
  }, []);

  const beginEmailSignIn = useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      setStatus({ type: "error", message: "이메일과 비밀번호를 입력해주세요." });
      return;
    }

    setBusyType("auth");
    try {
      await signInWithEmail({ email, password });
      setStatus({ type: "success", message: "로그인되었습니다." });
      await refreshClubs();
    } catch (error) {
      setStatus({ type: "error", message: toMessage(error) });
      setBusyType(null);
    }
  }, [email, password, refreshClubs]);

  const beginEmailSignUp = useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      setStatus({ type: "error", message: "이메일과 비밀번호를 입력해주세요." });
      return;
    }

    setBusyType("auth");
    try {
      await signUpWithEmail({ email, password });
      setStatus({ type: "success", message: "회원가입 요청이 완료되었습니다. 이메일 인증을 확인하세요." });
      setBusyType(null);
    } catch (error) {
      setStatus({ type: "error", message: toMessage(error) });
      setBusyType(null);
    }
  }, [email, password]);

  const logout = useCallback(async () => {
    setBusyType("auth");
    try {
      await signOut();
      setUser(null);
      setClubs([]);
      setStatus({ type: "info", message: "로그아웃되었습니다." });
      await refreshClubs();
    } catch (error) {
      setStatus({ type: "error", message: toMessage(error) });
      setBusyType(null);
    }
  }, [refreshClubs]);

  return {
    user,
    clubs,
    activeTab,
    setActiveTab,
    busyType,
    isBusy,
    status,
    refreshClubs,
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
  };
}
