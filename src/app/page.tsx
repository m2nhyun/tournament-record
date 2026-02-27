"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabaseClient } from "@/lib/supabase/client";

type ClubEntity = {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
};

type ClubRow = {
  role: "owner" | "manager" | "member";
  nickname: string;
  clubs: ClubEntity | ClubEntity[] | null;
};

type ClubSummary = {
  id: string;
  name: string;
  inviteCode: string;
  role: ClubRow["role"];
  nickname: string;
  createdAt: string;
};

function normalizeClub(club: ClubRow["clubs"]): ClubEntity | null {
  if (!club) return null;
  if (Array.isArray(club)) return club[0] ?? null;
  return club;
}

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join(
    ""
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export default function Home() {
  const [clubs, setClubs] = useState<ClubSummary[]>([]);
  const [status, setStatus] = useState<string>("시작하려면 클럽을 만들거나 참가 코드를 입력하세요.");
  const [busyType, setBusyType] = useState<"create" | "join" | "refresh" | null>(null);

  const [createName, setCreateName] = useState("");
  const [createNickname, setCreateNickname] = useState("");

  const [joinCode, setJoinCode] = useState("");
  const [joinNickname, setJoinNickname] = useState("");

  const isBusy = useMemo(() => busyType !== null, [busyType]);

  const ensureUser = useCallback(async () => {
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError) throw userError;
    if (user) return user;

    const { data, error } = await supabaseClient.auth.signInAnonymously();
    if (error || !data.user) {
      throw new Error(
        "익명 로그인에 실패했습니다. Supabase Auth 설정에서 Anonymous Sign-ins를 켜주세요."
      );
    }

    return data.user;
  }, []);

  const refreshClubs = useCallback(async () => {
    setBusyType("refresh");

    try {
      const user = await ensureUser();
      const { data, error } = await supabaseClient
        .from("club_members")
        .select("role,nickname,clubs(id,name,invite_code,created_at)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows = (data ?? []) as ClubRow[];
      const parsed = rows
        .map((row) => {
          const club = normalizeClub(row.clubs);
          if (!club) return null;

          return {
            id: club.id,
            name: club.name,
            inviteCode: club.invite_code,
            role: row.role,
            nickname: row.nickname,
            createdAt: club.created_at,
          };
        })
        .filter((row): row is ClubSummary => row !== null);

      setClubs(parsed);
      if (parsed.length > 0) {
        setStatus(`총 ${parsed.length}개 클럽을 불러왔습니다.`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "클럽 목록을 불러오지 못했습니다.");
    } finally {
      setBusyType(null);
    }
  }, [ensureUser]);

  useEffect(() => {
    void refreshClubs();
  }, [refreshClubs]);

  async function handleCreateClub(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!createName.trim() || !createNickname.trim()) {
      setStatus("클럽 이름과 내 닉네임을 입력해주세요.");
      return;
    }

    setBusyType("create");
    try {
      const user = await ensureUser();
      const inviteCode = generateInviteCode();

      const { data: createdClub, error: createError } = await supabaseClient
        .from("clubs")
        .insert({
          name: createName.trim(),
          invite_code: inviteCode,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (createError || !createdClub) {
        throw createError ?? new Error("클럽 생성에 실패했습니다.");
      }

      const { error: memberError } = await supabaseClient.from("club_members").insert({
        club_id: createdClub.id,
        user_id: user.id,
        role: "owner",
        nickname: createNickname.trim(),
      });

      if (memberError) throw memberError;

      setCreateName("");
      setStatus(`클럽이 생성되었습니다. 참가 코드: ${inviteCode}`);
      await refreshClubs();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "클럽 생성 중 오류가 발생했습니다.");
    } finally {
      setBusyType(null);
    }
  }

  async function handleJoinClub(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!joinCode.trim() || !joinNickname.trim()) {
      setStatus("참가 코드와 닉네임을 입력해주세요.");
      return;
    }

    setBusyType("join");
    try {
      await ensureUser();

      const { error } = await supabaseClient.rpc("join_club_by_invite", {
        p_invite_code: joinCode.trim().toUpperCase(),
        p_nickname: joinNickname.trim(),
      });

      if (error) throw error;

      setJoinCode("");
      setStatus("클럽 참가가 완료되었습니다.");
      await refreshClubs();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "클럽 참가 중 오류가 발생했습니다.");
    } finally {
      setBusyType(null);
    }
  }

  return (
    <div className="min-h-screen text-foreground">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-10">
        <header className="mx-auto w-full max-w-3xl rounded-3xl border border-border/70 bg-white/80 p-5 shadow-[0_24px_90px_rgba(13,24,16,0.08)] backdrop-blur-sm sm:p-8">
          <p className="inline-flex rounded-full border border-border bg-[var(--surface-2)] px-3 py-1 text-[11px] font-medium tracking-[0.17em] text-muted-foreground uppercase">
            Tournament Record
          </p>
          <h1 className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            클럽 기록을
            <span className="block text-[var(--brand-foreground)]">간단하게 시작하세요</span>
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
            월례회/모임에서 경기 기록, 참가 코드, 히스토리를 한 화면에서 관리합니다.
          </p>
          <p className="mt-4 rounded-xl border border-border bg-background/70 px-3 py-2 text-xs text-muted-foreground">
            {status}
          </p>
        </header>

        <section className="mx-auto mt-4 grid w-full max-w-3xl gap-3 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>클럽 만들기</CardTitle>
              <CardDescription>운영자/호스트 기준으로 새 모임을 생성합니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={handleCreateClub}>
                <div className="space-y-1.5">
                  <Label htmlFor="club-name">클럽 이름</Label>
                  <Input
                    id="club-name"
                    placeholder="예: 강남 토요 테니스"
                    value={createName}
                    onChange={(event) => setCreateName(event.target.value)}
                    maxLength={40}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="owner-nickname">내 닉네임</Label>
                  <Input
                    id="owner-nickname"
                    placeholder="예: 민현"
                    value={createNickname}
                    onChange={(event) => setCreateNickname(event.target.value)}
                    maxLength={20}
                  />
                </div>
                <Button
                  className="w-full bg-[var(--brand)] text-[var(--brand-foreground)]"
                  disabled={isBusy}
                >
                  {busyType === "create" ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      생성 중...
                    </span>
                  ) : (
                    "클럽 생성"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>참가 코드로 입장</CardTitle>
              <CardDescription>운영진이 공유한 코드로 기존 클럽에 참가합니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={handleJoinClub}>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-code">참가 코드</Label>
                  <Input
                    id="invite-code"
                    placeholder="예: 7KD2QP"
                    value={joinCode}
                    onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                    maxLength={6}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="member-nickname">내 닉네임</Label>
                  <Input
                    id="member-nickname"
                    placeholder="예: 미니"
                    value={joinNickname}
                    onChange={(event) => setJoinNickname(event.target.value)}
                    maxLength={20}
                  />
                </div>
                <Button className="w-full" variant="outline" disabled={isBusy}>
                  {busyType === "join" ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      참가 중...
                    </span>
                  ) : (
                    "클럽 참가"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>

        <section className="mx-auto mt-4 w-full max-w-3xl">
          <Card>
            <CardHeader className="flex items-center justify-between gap-2 sm:flex-row">
              <div>
                <CardTitle>내 클럽</CardTitle>
                <CardDescription>참가 중인 클럽과 내 역할을 확인합니다.</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => void refreshClubs()} disabled={isBusy}>
                {busyType === "refresh" ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    새로고침
                  </span>
                ) : (
                  "새로고침"
                )}
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {clubs.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-3 py-5 text-center text-sm text-muted-foreground">
                  아직 참가한 클럽이 없습니다.
                </p>
              ) : (
                clubs.map((club) => (
                  <article
                    key={club.id}
                    className="rounded-xl border border-border bg-background/70 px-3 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold sm:text-base">{club.name}</h3>
                      <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                        {club.role}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      닉네임: {club.nickname} · 참가 코드: {club.inviteCode} · 생성일: {" "}
                      {formatDate(club.createdAt)}
                    </p>
                  </article>
                ))
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
