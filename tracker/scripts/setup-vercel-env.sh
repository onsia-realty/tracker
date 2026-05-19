#!/bin/bash
# 트래커 Vercel 환경변수 자동 등록 + 재배포
# 사용: bash D:/claude/부정클릭/tracker/scripts/setup-vercel-env.sh

set -e
cd "$(dirname "$0")/.."

ONSIA_ENV="D:/claude/홈페이지/onsia_homepage_new/.env"

if [ ! -f "$ONSIA_ENV" ]; then
  echo "❌ onsia .env 못 찾음: $ONSIA_ENV"
  exit 1
fi

echo "📥 onsia .env에서 값 로드..."
set -a
. "$ONSIA_ENV"
set +a

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL 비어있음. onsia .env 확인 필요"
  exit 1
fi

# UNPOOLED URL = 6543→5432 + pgbouncer 옵션 제거
UNP=$(echo "$DATABASE_URL" | sed -E 's/:6543\//:5432\//; s/\?pgbouncer=true//; s/&pgbouncer=true//')

# ADMIN_PHONE 폴백
ADMIN_PHONE_VAL="${ADMIN_PHONE:-}"
if [ -z "$ADMIN_PHONE_VAL" ]; then
  read -p "📱 YDG 휴대폰 번호 (010-XXXX-XXXX 형식): " ADMIN_PHONE_VAL
fi

echo ""
echo "🗑  기존 변수 제거 (있으면)..."
for VAR in DATABASE_URL DATABASE_URL_UNPOOLED SOLAPI_API_KEY SOLAPI_API_SECRET SMS_SENDER_NUMBER ADMIN_PHONE; do
  npx vercel env rm "$VAR" production --yes 2>/dev/null || true
done

echo ""
echo "✅ 새 변수 등록..."
echo "$DATABASE_URL"        | npx vercel env add DATABASE_URL production
echo "$UNP"                 | npx vercel env add DATABASE_URL_UNPOOLED production
echo "$SOLAPI_API_KEY"      | npx vercel env add SOLAPI_API_KEY production
echo "$SOLAPI_API_SECRET"   | npx vercel env add SOLAPI_API_SECRET production
echo "$SMS_SENDER_NUMBER"   | npx vercel env add SMS_SENDER_NUMBER production
echo "$ADMIN_PHONE_VAL"     | npx vercel env add ADMIN_PHONE production

echo ""
echo "🚀 재배포 시작..."
npx vercel --prod --yes

echo ""
echo "✅ 완료!"
