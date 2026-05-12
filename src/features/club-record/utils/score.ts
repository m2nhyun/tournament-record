export type ParsedClubRecordScore =
  | {
      isDraw: true;
      winningSide: null;
      losingSide: null;
      normalizedScoreText: string;
    }
  | {
      isDraw: false;
      winningSide: 1 | 2;
      losingSide: 1 | 2;
      normalizedScoreText: string;
    };

const SCORE_PATTERN = /^\s*(\d+)\s*-\s*(\d+)\s*$/;

export function parseClubRecordScoreText(scoreText: string): ParsedClubRecordScore {
  const normalized = scoreText.trim();
  const matched = normalized.match(SCORE_PATTERN);

  if (!matched) {
    throw new Error("스코어는 `6-4` 형식으로 입력해주세요.");
  }

  const side1 = Number(matched[1]);
  const side2 = Number(matched[2]);

  if (!Number.isInteger(side1) || !Number.isInteger(side2)) {
    throw new Error("스코어는 숫자만 입력해주세요.");
  }

  if (side1 < 0 || side2 < 0) {
    throw new Error("스코어는 0 이상이어야 합니다.");
  }

  const normalizedScoreText = `${side1}-${side2}`;

  if (side1 === side2) {
    return {
      isDraw: true,
      winningSide: null,
      losingSide: null,
      normalizedScoreText,
    };
  }

  if (side1 > side2) {
    return {
      isDraw: false,
      winningSide: 1,
      losingSide: 2,
      normalizedScoreText,
    };
  }

  return {
    isDraw: false,
    winningSide: 2,
    losingSide: 1,
    normalizedScoreText,
  };
}
