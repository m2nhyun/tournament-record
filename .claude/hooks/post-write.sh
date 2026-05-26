#!/bin/bash
input=$(cat)
file=$(echo "$input" | jq -r '.tool_input.file_path // empty')

[ -z "$file" ] && exit 0

PROJECT="/Users/minhyun/Desktop/tournament-record"
cd "$PROJECT" || exit 0

# ESLint fix on .ts/.tsx
if [[ "$file" == *.ts || "$file" == *.tsx ]]; then
  npx eslint --fix "$file" --quiet 2>/dev/null
fi

# Run test immediately when test file is edited
if [[ "$file" == *.test.ts || "$file" == *.test.tsx ]]; then
  echo "--- 테스트 실행: $(basename "$file") ---"
  npx vitest run "$file" 2>&1 | tail -15
fi

exit 0
