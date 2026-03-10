import { Minus, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { SetScore } from "@/features/matches/types/match";

type ScoreInputProps = {
  setScores: SetScore[];
  onUpdate: (
    setIndex: number,
    side: "side1" | "side2" | "side1Point" | "side2Point",
    value: number | "0" | "15" | "30" | "40" | "AD" | "",
  ) => void;
  onAddSet: () => void;
  onRemoveLastSet: () => void;
  onRemoveSet: (setIndex: number) => void;
  gamesToWin: 4 | 6;
  onChangeGamesToWin: (value: 4 | 6) => void;
  side1Label?: string;
  side2Label?: string;
};

const GAME_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7] as const;
const POINT_OPTIONS = ["", "15", "30", "40", "AD"] as const;

function isGameRoundCompleted(score: SetScore, fallbackGamesToWin: 4 | 6) {
  const target = score.gamesToWin ?? fallbackGamesToWin;
  const winner = Math.max(score.side1, score.side2);
  const loser = Math.min(score.side1, score.side2);
  if (winner < target) return false;
  if (winner === target && winner - loser >= 2) return true;
  return winner === target + 1 && loser === target;
}

export function ScoreInput({
  setScores,
  onUpdate,
  onAddSet,
  onRemoveLastSet,
  onRemoveSet,
  gamesToWin,
  onChangeGamesToWin,
  side1Label = "팀 A",
  side2Label = "팀 B",
}: ScoreInputProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>게임 스코어 입력</Label>
        <p className="text-xs text-muted-foreground">
          포인트는 선택 입력입니다. 일반 게임은 비워두고, 필요할 때만 입력하세요.
        </p>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">목표 게임</Label>
          <div className="inline-flex rounded-md border p-1">
            <button
              type="button"
              className={`rounded px-2 py-1 text-xs ${gamesToWin === 6 ? "bg-[var(--brand)] text-white" : ""}`}
              onClick={() => onChangeGamesToWin(6)}
            >
              6게임
            </button>
            <button
              type="button"
              className={`rounded px-2 py-1 text-xs ${gamesToWin === 4 ? "bg-[var(--brand)] text-white" : ""}`}
              onClick={() => onChangeGamesToWin(4)}
            >
              4게임
            </button>
          </div>
        </div>
      </div>

      {setScores.map((score, index) => {
        const complete = isGameRoundCompleted(score, gamesToWin);
        return (
          <div key={index} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                게임 {score.set}
              </p>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[11px] ${complete ? "text-emerald-600" : "text-amber-600"}`}
                >
                  {complete ? "완료" : "미완료"}
                </span>
                <button
                  type="button"
                  className="inline-flex size-7 items-center justify-center rounded-md border text-muted-foreground hover:bg-accent"
                  onClick={() => onRemoveSet(index)}
                  aria-label={`게임 ${score.set} 삭제`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[11px] text-muted-foreground">
                  {side1Label}
                </Label>
                <div className="flex flex-wrap gap-1">
                  {GAME_OPTIONS.map((option) => (
                    <button
                      key={`s1-g-${score.set}-${option}`}
                      type="button"
                      className={`rounded border px-2 py-1 text-xs ${score.side1 === option ? "bg-[var(--brand)] text-white" : "bg-background"}`}
                      onClick={() => onUpdate(index, "side1", option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1">
                  {POINT_OPTIONS.map((point) => (
                    <button
                      key={`s1-p-${score.set}-${point}`}
                      type="button"
                      className={`rounded border px-2 py-1 text-[11px] ${((score.side1Point ?? "") === point) ? "bg-foreground text-background" : "bg-background"}`}
                      onClick={() =>
                        onUpdate(index, "side1Point", point as "" | "0" | "15" | "30" | "40" | "AD")
                      }
                    >
                      {point === "" ? "미입력" : point}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] text-muted-foreground">
                  {side2Label}
                </Label>
                <div className="flex flex-wrap gap-1">
                  {GAME_OPTIONS.map((option) => (
                    <button
                      key={`s2-g-${score.set}-${option}`}
                      type="button"
                      className={`rounded border px-2 py-1 text-xs ${score.side2 === option ? "bg-[var(--brand)] text-white" : "bg-background"}`}
                      onClick={() => onUpdate(index, "side2", option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1">
                  {POINT_OPTIONS.map((point) => (
                    <button
                      key={`s2-p-${score.set}-${point}`}
                      type="button"
                      className={`rounded border px-2 py-1 text-[11px] ${((score.side2Point ?? "") === point) ? "bg-foreground text-background" : "bg-background"}`}
                      onClick={() =>
                        onUpdate(index, "side2Point", point as "" | "0" | "15" | "30" | "40" | "AD")
                      }
                    >
                      {point === "" ? "미입력" : point}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {setScores.length === 0 ? (
        <div className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
          남아 있는 게임이 없습니다. 새 게임을 추가하거나 경기를 삭제할 수 있습니다.
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAddSet}
          className="flex-1"
        >
          <Plus className="size-4" />
          게임 추가
        </Button>
        {setScores.length > 1 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRemoveLastSet}
            className="flex-1"
          >
            <Minus className="size-4" />
            마지막 게임 삭제
          </Button>
        ) : null}
      </div>
    </div>
  );
}
