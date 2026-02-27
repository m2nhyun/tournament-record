import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center gap-10 px-6 py-20 text-center">
        <p className="rounded-full border border-border px-4 py-1 text-xs tracking-[0.2em] text-muted-foreground uppercase">
          Tournament Record
        </p>
        <div className="space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            아마추어 테니스 기록을
            <br />
            가장 쉽게 시작하는 방법
          </h1>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground sm:text-base">
            모임 생성, 경기 입력, 히스토리 조회까지. 토너먼트 레코드는
            클럽/월례회 운영을 위한 가장 가벼운 기록 루프를 제공합니다.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button size="lg">모임 만들기</Button>
          <Button variant="outline" size="lg">
            참가 코드로 입장
          </Button>
        </div>
      </main>
    </div>
  );
}
