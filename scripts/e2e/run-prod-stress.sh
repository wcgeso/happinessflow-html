#!/usr/bin/env bash
# Production 50-turn stress run: 1 coach + 4 players against https://2ife.vercel.app
# and the production Firestore. Passwords are read silently and only live in
# this process's environment.
set -euo pipefail
cd "$(dirname "$0")/../.."

echo "即將對【正式環境】執行 1 位執行師 + 4 位玩家的 50 回合測試。"
echo "會在正式資料庫建立一間測試房間，並以管理權限修改該房間的牌堆與玩家位置。"
read -r -p "確定要繼續嗎？(yes/no) " confirm
[ "$confirm" = "yes" ] || { echo "已取消"; exit 1; }

read -r -p "執行師 Email: " HF_E2E_COACH_EMAIL
read -r -s -p "執行師密碼: " HF_E2E_COACH_PASSWORD; echo
export HF_E2E_COACH_EMAIL HF_E2E_COACH_PASSWORD
for i in 1 2 3 4; do
  read -r -p "玩家${i} Email: " email
  read -r -p "玩家${i} 顯示名稱（登入後畫面上的名字）: " name
  read -r -s -p "玩家${i} 密碼: " password; echo
  export "HF_E2E_P${i}_EMAIL=$email" "HF_E2E_P${i}_NAME=$name" "HF_E2E_P${i}_PASSWORD=$password"
done

export E2E_TARGET=prod E2E_STRESS_PLAYERS=4 E2E_BASE_URL=https://2ife.vercel.app
export E2E_CARD_SET="${E2E_CARD_SET:-safe}" E2E_TURNS="${E2E_TURNS:-50}"
export E2E_STRESS_REPORT="e2e/report/prod-4p-${E2E_CARD_SET}-${E2E_TURNS}-turn.json"
npx playwright test -c playwright.prod.config.ts
echo "報告：$E2E_STRESS_REPORT"
