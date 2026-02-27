import { Button } from "@/components/ui/button";

const highlights = [
  {
    title: "빠른 기록",
    description: "경기 종료 후 20초 내 점수 입력. 운영진/참가자 모두 모바일에서 바로 처리.",
  },
  {
    title: "신뢰 가능한 히스토리",
    description: "누가 언제 수정했는지 변경 이력을 남겨 기록 분쟁을 줄입니다.",
  },
  {
    title: "클럽 운영 중심",
    description: "참가 코드, 월례회 진행, 시즌 보드를 클럽 단위로 가볍게 시작합니다.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen text-foreground">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-10">
        <div className="mx-auto w-full max-w-3xl rounded-3xl border border-border/70 bg-white/80 p-5 shadow-[0_24px_90px_rgba(13,24,16,0.08)] backdrop-blur-sm sm:p-8">
          <p className="inline-flex rounded-full border border-border bg-[var(--surface-2)] px-3 py-1 text-[11px] font-medium tracking-[0.17em] text-muted-foreground uppercase">
            Tournament Record
          </p>
          <h1 className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            아마추어 테니스 기록을
            <span className="block text-[var(--brand-foreground)]">가볍고 명확하게</span>
          </h1>
          <p className="mt-3 text-pretty text-sm leading-6 text-muted-foreground sm:text-base">
            모임 생성, 경기 입력, 히스토리 조회까지. 토너먼트 레코드는 클럽/월례회
            운영을 위한 가장 단순한 기록 루프를 만듭니다.
          </p>
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            <Button className="w-full bg-[var(--brand)] text-[var(--brand-foreground)] hover:opacity-95 sm:w-auto" size="lg">
              모임 만들기
            </Button>
            <Button className="w-full sm:w-auto" variant="outline" size="lg">
              참가 코드로 입장
            </Button>
          </div>
        </div>

        <div className="mx-auto mt-4 grid w-full max-w-3xl gap-3 sm:mt-5 sm:grid-cols-3">
          {highlights.map((item) => (
            <section
              key={item.title}
              className="rounded-2xl border border-border bg-card/90 p-4 shadow-[0_6px_24px_rgba(13,24,16,0.06)]"
            >
              <h2 className="text-sm font-semibold sm:text-base">{item.title}</h2>
              <p className="mt-2 text-xs leading-5 text-muted-foreground sm:text-sm">
                {item.description}
              </p>
            </section>
          ))}
        </div>

        <p className="mx-auto mt-5 w-full max-w-3xl text-center text-xs leading-5 text-muted-foreground">
          목표: 기록 습관 형성, 기록 완결성 검증, 클럽 운영 시간 절감
        </p>
      </main>
    </div>
  );
}
