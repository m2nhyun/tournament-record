#!/bin/bash
input=$(cat)
file=$(echo "$input" | jq -r '.tool_input.file_path // empty')

[ -z "$file" ] && exit 0

if echo "$file" | grep -qE 'src/features/auth/services/auth\.ts|supabase/migrations/|supabase/schema\.sql'; then
  echo "⚠️  고위험 파일: $(basename "$file")"
  echo "수정 전 확인:"
  echo "  1. AGENTS.md Section 3 도메인 규칙 검토"
  echo "  2. DB 변경이라면 마이그레이션 파일 준비 여부"
  echo "  3. 관련 테스트 추가/업데이트 계획 여부"
fi

exit 0
