import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { SetScore } from "@/features/matches/types/match";

type ScoreInputProps = {
  setScores: SetScore[];
  onUpdate: (
    setIndex: number,
    side: "side1" | "side2" | "side1Point" | "side2Point",
    value: number | "0" | "15" | "30" | "40" | "AD",
  ) => void;
  onAddSet: () => void;
  onRemoveLastSet: () => void;
  side1Label?: string;
  side2Label?: string;
};

const GAME_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7] as const;
const POINT_OPTIONS = ["0", "15", "30", "40", "AD"] as const;

export function ScoreInput({
  setScores,
  onUpdate,
  onAddSet,
  onRemoveLastSet,
  side1Label = "사이드 1",
  side2Label = "사이드 2",
}: ScoreInputProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>세트별 게임 스코어</Label>
        <p className="text-xs text-muted-foreground">
          테니스 규칙상 포인트(0/15/30/40)로 게임이 진행되고, 이 입력은 각 세트의
          최종 게임 수(예: 6:4)를 기록합니다.
        </p>
      </div>

      {setScores.map((score, index) => (
        <div key={index} className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            세트 {score.set}
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Label className="mb-1 text-[11px] text-muted-foreground">
                {side1Label}
              </Label>
              <div className="grid grid-cols-4 gap-1.5 rounded-md border p-2">
                {GAME_OPTIONS.map((option) => (
                  <label
                    key={`s1-${score.set}-${option}`}
                    className="flex cursor-pointer items-center gap-1 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={score.side1 === option}
                      onChange={(e) =>
                        onUpdate(index, "side1", e.target.checked ? option : 0)
                      }
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Label className="text-[11px] text-muted-foreground">
                  현재 포인트
                </Label>
                <select
                  className="h-8 rounded-md border bg-background px-2 text-xs"
                  value={score.side1Point ?? "0"}
                  onChange={(e) =>
                    onUpdate(
                      index,
                      "side1Point",
                      e.target.value as "0" | "15" | "30" | "40" | "AD",
                    )
                  }
                >
                  {POINT_OPTIONS.map((point) => (
                    <option key={`s1p-${score.set}-${point}`} value={point}>
                      {point}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <span className="pt-4 text-lg font-bold text-muted-foreground">
              :
            </span>
            <div className="flex-1">
              <Label className="mb-1 text-[11px] text-muted-foreground">
                {side2Label}
              </Label>
              <div className="grid grid-cols-4 gap-1.5 rounded-md border p-2">
                {GAME_OPTIONS.map((option) => (
                  <label
                    key={`s2-${score.set}-${option}`}
                    className="flex cursor-pointer items-center gap-1 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={score.side2 === option}
                      onChange={(e) =>
                        onUpdate(index, "side2", e.target.checked ? option : 0)
                      }
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Label className="text-[11px] text-muted-foreground">
                  현재 포인트
                </Label>
                <select
                  className="h-8 rounded-md border bg-background px-2 text-xs"
                  value={score.side2Point ?? "0"}
                  onChange={(e) =>
                    onUpdate(
                      index,
                      "side2Point",
                      e.target.value as "0" | "15" | "30" | "40" | "AD",
                    )
                  }
                >
                  {POINT_OPTIONS.map((point) => (
                    <option key={`s2p-${score.set}-${point}`} value={point}>
                      {point}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      ))}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAddSet}
          className="flex-1"
        >
          <Plus className="size-4" />
          세트 추가
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
            마지막 세트 삭제
          </Button>
        ) : null}
      </div>
    </div>
  );
}
