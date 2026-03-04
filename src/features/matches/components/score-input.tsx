import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SetScore } from "@/features/matches/types/match";

type ScoreInputProps = {
  setScores: SetScore[];
  onUpdate: (setIndex: number, side: "side1" | "side2", value: number) => void;
  onAddSet: () => void;
  onRemoveLastSet: () => void;
};

export function ScoreInput({
  setScores,
  onUpdate,
  onAddSet,
  onRemoveLastSet,
}: ScoreInputProps) {
  return (
    <div className="space-y-4">
      <Label>세트별 점수</Label>

      {setScores.map((score, index) => (
        <div key={index} className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            세트 {score.set}
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Label className="mb-1 text-[11px] text-muted-foreground">
                사이드 1
              </Label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={score.side1}
                onChange={(e) =>
                  onUpdate(
                    index,
                    "side1",
                    Math.max(0, parseInt(e.target.value) || 0),
                  )
                }
                className="text-center text-lg font-semibold"
              />
            </div>
            <span className="pt-4 text-lg font-bold text-muted-foreground">
              :
            </span>
            <div className="flex-1">
              <Label className="mb-1 text-[11px] text-muted-foreground">
                사이드 2
              </Label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={score.side2}
                onChange={(e) =>
                  onUpdate(
                    index,
                    "side2",
                    Math.max(0, parseInt(e.target.value) || 0),
                  )
                }
                className="text-center text-lg font-semibold"
              />
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
