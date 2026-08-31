# 第二人生 P0 Integration Handoff

## 2026-08-30 v2.8 系統更新日誌與版本號

- 對外版本號更新為 `v2.8`；執行師端系統更新日誌置頂醫療理賠按鈕與 C035–C043 保險行為修正。
- `package.json` 維持既有 `0.0.0`，版本顯示仍由 `src/constants/version.ts` 的 `BASE_VERSION` 管理。
- 驗證：`npm run typecheck`、`npx vitest run src`（31 files、199 passed、23 skipped）、Firestore Rules `23/23`、`npm run build`、`git diff --check` 通過。
- 已部署至 `2ife` production：`dpl_AvLn7EDxj7tGs44NNa9dfwVQMjdf`，狀態 `READY`；正式網址 `https://2ife.vercel.app`，HTTP 200。
- 依使用者確認，已永久刪除舊 Vercel 專案 `happinessflow-online` 及其 deployments；舊網址回應 HTTP 404，`2ife.vercel.app` 回應 HTTP 200。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次修改檔案：`src/constants/version.ts`、`src/views/lobby/CoachDashboard.tsx`
- 測試結果：typecheck、Vitest 31 files／199 passed／23 skipped、production build、git diff check 通過；既有 Rules 專測 23/23
- 目前風險：尚未以真實帳號確認正式站 v2.8 日誌內容與完整多人理賠流程。
- 下一個最安全任務：在 `https://2ife.vercel.app` 以測試帳號確認登入、執行師日誌與 C036 理賠流程。

## 2026-08-29 房市規則修訂版與 11 項異常修正

- 目前分支：`dev`（`15caa41`）；保留工作樹原有未提交修改，未執行 reset、clean 或覆寫其他既有變更。
- 房市交易改為所有仍在進行中的有效成員可購買；交易以 Firestore transaction 先成功者得標，Rules 僅允許移除一個既有物件、更新自己的公開摘要、revision 與 command ledger，禁止新增物件、多重移除、改回合或改他人資料。
- 房市 transaction 會重新驗證物件、房屋條件、最新現金與貸款資料；售出或條件過期不提交 revision／command／空白事件，UI 只停用被點擊物件並刷新房市。財務流程改用明確 `boardFlow`，不再從殘留狀態猜測來源。
- 工作室升級改為佇列，逐筆經銀行處理；升級收益為骰點 × 10,000，保留職業薪資，結果確認後才完成流程。汽車自備款可清空／輸入，確認時才驗證上下限。
- C038 改為同一筆原子處理：移除汽車、幸福值、投保理賠；原車貸保持不變，並以 command ID 防止重送。醫療保險維持抵免醫藥費、略過第二次骰子與付款檢核、仍暫停一回合；維修廠維持持車者經過或停留均收費。
- 玩家卡片抽屜補上完整敘述與效果，修正手機遮罩與捲動；共享卡片被暫時阻擋後沿用重新顯示流程。
- 驗證：`npm run typecheck` 通過；source Vitest `30 passed / 1 skipped`、`184 passed / 23 skipped`；Firestore Rules 直接連線測試 `23/23`；`npm run build` 與 `git diff --check` 通過。建置仍有既有 Tailwind ambiguous class、dynamic import 與 chunk size 警告。
- `npm run test:rules` 未能重啟本地 Emulator，因既有 Java 程序已佔用 `8080/9150`；未終止該程序，改用現有 Emulator 的 Rules 專測完成驗證。
- 尚未完成 3／6 位玩家的真實多人瀏覽器競買、同物件競爭、不同物件並購與重整／網路重送驗收；下一個最安全任務是啟動隔離的多人 E2E 環境逐項執行上述驗收。

## 2026-08-28 v2.7 系統更新日誌

- 對外版本號更新為 `v2.7`。
- 連線 presence 改由 Realtime Database 管理，每個分頁使用獨立連線節點與斷線自動清理，降低 Firestore 心跳寫入量。
- 關閉分頁、重新開啟或重新登入可依未完成房間恢復；同帳號多分頁由最新分頁取得操作權，舊分頁改為唯讀。
- 房間與玩家同步改以伺服器確認快照為準，避免舊快照覆蓋目前回合、事件與玩家資料；歷史與執行師診斷改為低頻或需要時讀取。
- 驗證：`npm run typecheck`、source Vitest `180 passed / 22 skipped`、Firestore Rules `22/22`、`npm run build` 與 `git diff --check` 通過；建置僅有既有 Tailwind／chunk size 警告。
- 已部署至 `happinessflow-online` production：`dpl_9hUhRaTZnzsYd4yoGTYfKZUXvt8c`，狀態 `READY`；正式網址 HTTP 200，production bundle 已確認包含 `v2.7`。
- 6 位玩家＋1 位執行師的長時間實機用量驗收仍未宣稱完成。

## 2026-08-28 Firebase 連線與用量優化執行結果

- 目前分支：`dev`；保留工作樹所有既有未提交修改。
- Auth 改為 `browserLocalPersistence`，並以使用者文件 `activeGame.roomId` 支援關閉重開／重新登入恢復未完成房間；遊戲中暫時離開只離開畫面、不移除座位。
- Presence 改為既有 RTDB：每個分頁建立 `roomConnections/{roomId}/{uid}/{clientId}`，斷線自動移除，`roomLastOnline` 保存最後離線時間；移除 Firestore heartbeat fallback。
- 玩家診斷改為 RTDB 暫時節點；Firestore room snapshot 使用 metadata，只有 server snapshot 才執行路由、成員清理與過期移動修復。
- 玩家同步移除同步前預讀，改為欄位白名單 merge；避免用舊 UI 快照回寫棋盤事件、位置與 prompt。
- 新增同帳號分頁控制權：最新分頁 claim，舊分頁的 board mutation 與主要直接寫入會被唯讀 guard 擋下。
- 大廳／結算歷史改一次性 `getDocs`，遊戲進行中不持續監聽；本地 Firebase Emulator 新增 RTDB `9000`。
- 驗證：`npm run typecheck` 通過；source Vitest `179 passed / 22 skipped`；Firestore Rules 既有 Emulator `22/22`；`npm run build`、`git diff --check` 通過。
- `npm run test:rules` 因既有 Firestore Emulator 佔用 8080 無法重啟；改以 `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npx vitest run src/test/roomPermissions.test.ts` 完成，未終止既有程序。
- 尚未完成真實瀏覽器多人重連與 6+1、120 分鐘用量驗收；不能以本地 Emulator 數據直接代表 Firebase 雲端帳單。

## 2026-08-27 Firestore 用量優化第一階段

- 在 `dev` 工作樹保留既有未提交修改，完成 presence、同步、存檔、歷史讀取與診斷寫入的低成本優化。
- 正式環境 presence 改用既有 Realtime Database `roomConnections/{roomId}/{uid}/{clientId}` 連線節點與 `onDisconnect()`；Firestore Emulator 未配置 RTDB 時保留 Firestore fallback。
- 玩家狀態同步加入成功版本指紋，內容未變更時跳過讀取與回寫；玩家歷史草稿改為每 10 分鐘備份，執行師紀錄移除每分鐘全員重存。
- 歷史紀錄在遊戲進行中停止監聽，回到大廳／結算後恢復；診斷狀態改為 2 秒合併且相同內容不重送。交易、revision、command ID 與房間玩家文件權威來源不變。
- 新增與現有雲端格式一致的 `database.rules.json` 與 Firebase RTDB 設定；規則尚未直接發布，需由後續部署流程確認後發布。
- 驗證：`npm run typecheck`、`npx vitest run src`（30 files、179 passed、22 skipped）、既有 Firestore Rules 直接連線測試（22/22）、RTDB Emulator 規則啟動驗證、`npm run build`、`git diff --check` 通過。
- E2E 開房測試未執行：既有 `localhost:5183` 伺服器佔用 Playwright 需要的 port；未終止該程序。

## 2026-08-27 N058 創業貸款文案

- N058 說明改為先開設兼職工作室，再以該工作室申請創業貸款。
- 補充 5,000H 投入、600,000H 貸款、每月 3,000H 本利支出、經過銀行擲骰升級及升級後效果。
- 大地圖與共享卡片皆沿用 N058 `description` 欄位，因此會同步使用新文案。
- N057 文案保持原樣，避免相同格式卡片被誤改。
- 驗證：N058 文案回歸測試 5/5、`npm run typecheck`、`git diff --check` 通過；本次未部署。

## 2026-08-27 家庭歷程共用流程修正執行結果

- 目前分支：`dev`；保留工作樹內其他既有未提交修改。
- 已確認 14 張家庭歷程觸發卡共用同一套流程，五個家庭階段依各玩家自己的進度獨立推進。
- 已補上「3 位玩家、兩位擲骰失敗、抽卡玩家完成階段二後首次按下即結案」回歸測試與五階段效果測試。
- 驗證：source Vitest `176 passed / 22 skipped`、Firestore Rules `22 passed`、`npm run typecheck`、`npm run build`、`git diff --check` 通過。
- `.firebaserc` 預設 Firebase 專案已改為 `happinessflow-online`；新的 `firestore.rules` 已發布至正式專案。
- Vercel production 已部署並 Ready：`dpl_FU3NULLdjc5NQcKphKivJb4Mce4u`，網址 `https://happinessflow-online.vercel.app`，HTTP 200。
- 尚未完成三個真實帳號的瀏覽器回歸；部署後需用新房間驗證 H014／階段二第一次按下財務檢核即可完成，不需第二次點擊。

## 2026-08-27 家庭歷程階段二權限拒絕修正

- 修正抽卡玩家作為最後完成者時，財務檢核 transaction 同時更新玩家財務、來源完成狀態與清除家庭 prompt，卻不符合既有 Firestore 規則的問題。
- 改為先以原子 board transaction 提交自己的財務與 `sourceActionCompleted`，再以 `family-complete:{promptId}:{uid}` 冪等 command 清除 prompt 並推進事件；重試不會重複扣款。
- 新增 Firestore 規則回歸測試，涵蓋來源玩家先完成自身動作、再結束家庭事件。
- 驗證：source Vitest 171 passed／21 skipped；Firestore rules 21 passed；`npm run typecheck`、`npm run build`、`git diff --check` 通過。
- `npm run test:rules` 因既存 Firestore Emulator 已占用 8080 無法重新啟動；已使用現有 8080 執行同一規則測試。
- 尚未進行真實多帳號瀏覽器回歸；本次未 commit、push 或部署。

## Current branch

- Branch: `dev`
- Worktree: `.worktrees/dev`
- Existing uncommitted changes were preserved.

## 2026-08-22 system changelog

- Updated the coach-facing v2.3 system update log with the new liability adjustment, monthly expense adjustment, and read-only player diagnostics features.
- Kept the public app version at `v2.3`; no deployment or version bump was requested.

## 2026-08-21 coach correction and player diagnostics

- Added coach-only transactional adjustment for an existing liability's principal and monthly payment, plus persistent monthly expense adjustments for the three existing expense categories.
- Every correction requires a reason and appends before/after values to the player's existing transaction history; negative values and zero-principal/nonzero-payment states are blocked.
- Added read-only `rooms/{roomId}/diagnostics/{playerUid}` status for player flow, screen, event, pending action, and recent error. Players publish only on flow/error changes; coaches can read, but cannot control the player.
- Added Firestore rules and regression coverage for diagnostic ownership, financial adjustment pure helpers, invalid negative values, liability removal, and expense category updates.
- Validation: `npx vitest run src` passed 155 tests (29 files, 1 skipped); Firestore Emulator rules suite passed 19 tests; `npm run typecheck`, `npm run build`, and `git diff --check` passed.
- Deliberately deferred: real-time screen sharing, remote control, arbitrary loan creation, and one-time expense deduction.

## 2026-08-19 changelog

- Updated the displayed app version and coach changelog to `v2.2`.
- Added the new 2ife transparent login logo and removed the duplicate login title text.
- Documented the family-milestone flow repair: stage persistence after reload, first-roll gating, coach approval, and duplicate-operation protection.
- Deployed the current `dev` worktree to `https://happinessflow-online.vercel.app/` as production deployment `dpl_3FspX42pyrDYHXizcy1h3BzHyPWi`.

## 2026-08-20 family milestone auto-completion

- Fixed the missing transition after the drawing player and all family-milestone participants finish: the source client now automatically retries the existing `dismissBoardCard()` flow when the active Firestore prompt is complete.
- The completion predicate requires the matching current event/card, the source player, completed source action, and every target response/action; incomplete prompts still block the turn.
- Kept the `完成卡片` button as a manual retry for write failures and added an event-level in-flight guard against duplicate dismissal.
- Validation: family/board focused tests 56/56, Firestore rules 15/15, `npm run typecheck`, `npm run build`, and `git diff --check` passed.
- Known risk: real three-account browser replay for both last-source and last-target completion remains pending.

## Completed P0 work

- Integrated the current board movement-effects, idempotent settlement, and flow-log changes.
- Added `BoardState.revision` and a bounded `processedCommandIds` ledger.
- Added transaction wrapper `runRoomBoardMutation` and applied it to dice, movement settlement/recovery, reveal, prompts, market effects, shared expenses, and forced movement.
- Added deterministic command guards to event advance, dismiss, follow-up draws, and end-turn writes.
- Added `memberUids` lifecycle updates for create/join/leave/start.
- Replaced open room Firestore writes with member/host/own-state/board-command checks.
- Added regression coverage for revision replay, foreign player-state writes, non-member reads, identity changes, and shared-card responses.
- Moved new-room player financial state to `rooms/{roomId}/players/{uid}` and kept only a public projection on the room document.
- Added automatic migration for legacy `room.playerStates` documents and private-state cleanup at game start.
- Replaced cross-player shared-expense writes with a public board event that each player applies to their own private state.
- Added a release-only `npm run typecheck` gate and cleared the formal application source errors.
- Verified H009 story sharing is approval-gated before awarding its 2 happiness points.

## Validation

- Targeted Vitest: 21 tests passed across card resolver and card schema regression suites.
- `npm run build`: passed.
- `npm run typecheck`: passed.
- Rules tests were updated for private player documents and malicious public-projection writes; the local dependency/emulator environment still needs to be available to execute them.
- `RoomContext.test.ts`: adds a three-player board-start regression (coach excluded; all three players appear in turn order).

## Follow-up gates

- Run a real three-player Firebase session and confirm Coach reaches `3/3`, first H009 completes, and turn ownership advances. This remains intentionally excluded from the current repair scope.
- Run the Firestore emulator permission suite after the missing local test dependency is restored.

## P2/P3 progress

- P2-1 completed: Tailwind now builds through local PostCSS instead of the CDN; existing colors and visual direction were preserved.
- P2-1 completed: mobile viewport no longer blocks user scaling, global focus-visible styles were added, and reduced-motion support covers both system preference and `data-motion="reduced"`.
- P2-1 completed: primary dice, turn, banking, medical, target, and real-estate controls now expose accessible labels.
- P2-1 validation: release typecheck passed, 38 focused tests passed, production build passed, and CSS/viewport baseline assertions passed.
- Visual redesign, bee-related assets, audience, and market pilot remain intentionally deferred.
- Next item: P2-2 native core audio with local settings and event de-duplication.

## P2/P3 completed scope

- P2-2 completed: native Web Audio cues cover local dice, card reveal, cash in/out, happiness, and local turn start; audio can be muted from the game settings and is stored in `hf_audio_settings_v1`.
- P2-3 completed: shared happiness ranking and life recap are available to players, Coach, and the board projection. Ties use shared ranks (`1, 1, 3`); private financial recap is not exposed to other players or projection.
- P2-4 completed: Player and projection card views now consume the shared `CardPresentationModel`; the asset manifest remains an empty fallback until the new visual direction is approved.
- P3-1 completed: player-only six-emoji reactions use `rooms/{roomId}/reactions/{uid}`, show for three seconds, and enforce one send per second in both client logic and Firestore rules.
- Explicitly deferred: visual art/color redesign, bee-related assets, audience, and Market Pilot.
- Validation after P2/P3 scope: `npm run typecheck` passed, 44 focused tests passed, `npm run build` passed, and Firestore Emulator loaded `firestore.rules` successfully.

## Firestore stability fix

- Replaced the non-rule local player-state sync transaction in `GameContext` with a latest-state read plus merge batch, so it no longer competes with board transactions through the Firestore transaction stream.
- Preserved board-owned fields while syncing financial state and kept the public player projection atomic with the private player write.
- Added error handling to family-milestone prompt cleanup so rejected transactions no longer become unhandled promise rejections.
- Validation: `npm run typecheck`, `npm run build`, and browser reload passed; the page mounted normally after the change.
- Known risk: Firebase SDK `ca9`/`b815` internal assertions are also reported upstream; if the error recurs after a clean reload, capture the exact listener action and browser SDK URL before changing more code.

## Coach player-entry sync fix

- Room hosts now subscribe to all private player-state documents based on room ownership, even if the cached account role is stale.
- Coach readiness and waiting progress now use `publicPlayerStates` per player, with private `playerStates` as a legacy fallback; financial reports still read private state.
- Validation: `npm run typecheck`, `npm run build`, and logged-in browser reload passed.
- Known risk: a live multi-account room replay is still needed to verify the exact coach/player timing path.

## Reaction bar removal

- Player emoji reactions were removed from the game UI and client code.

## Emoji removal and dice permission fix

- Removed the player reaction UI and its unused client utilities/tests.
- Tightened board command rules so an open shared prompt cannot be bypassed by the current-turn player.
- Added a Firestore regression test covering a player dice transaction across private player state, event log, and room board state.
- Deployed the current `firestore.rules` to the actual app project `happinessflow-online`; the CLI default project remains `happinessflow-63b2e`.
- Validation: `npm run typecheck`, `npm run test:rules` (9 tests passed), and `npm run build` passed.
- Next check: hard-refresh the game page and retry the current player's dice action in a fresh room.

## Player news-card copy

- Player-side news cards now show only the original map-view instruction; news descriptions and impact summaries remain on the projection screen.
- Validation: `npm run typecheck` and `npm run build` passed.

## C034 enterprise-acquisition crash

- C034 now tolerates legacy enterprise assets without `cashflow` and player states without `liabilities`, preventing the card drawer and shared response modal from crashing during render.
- Added a regression test for the legacy asset shape; `src/utils/boardCardActions.test.ts` passed 20 tests and `npm run typecheck` passed.
- Next check: replay C034 with two player accounts, select an enterprise, then test both `放棄` and `進入出售`.

## Firestore unhandled rejection during card reveal

- The card reveal handler was launching `revealBoardCard` and shared/family prompt writes through a detached async Promise without an outer error handler. A rejected Firestore transaction therefore surfaced as `Unhandled Promise Rejection` and could make the card flow appear to disappear.
- The reveal flow now awaits the family prompt write inside the same `try/catch`, handles shared-prompt creation and final card dismissal failures, and reports the error in the game UI instead of leaving a rejected Promise behind.
- Audio unlock rejection is also ignored as a non-critical effect so it cannot interrupt card handling.
- Validation: `npm run typecheck` passed, 23 targeted card tests passed, and `npm run build` passed.
- Live follow-up: reload the player page, reveal C034, then verify the shared popup buttons. If Firestore still reports an error, capture the Firebase error code/message shown by the new in-game error alert.

## Shared C034 prompt stayed disabled after response

- The shared prompt visibility check did not exclude a prompt already answered by the current player. After Firestore synced the response, the same modal remained visible with its `放棄` / `進入出售` buttons disabled.
- Shared prompts now close for the responding player while remaining visible for players who still need to reply.
- Validation: `npm run typecheck`, 23 targeted card tests, and `npm run build` passed.

## Room lookup on localhost:5174

- `5174` is a second Vite instance of the same worktree; the configured primary port remains `5173`.
- Authentication persistence is origin-specific, so a login on `localhost:5173` is not automatically available on `localhost:5174`.
- Room create/join reads and writes no longer use `safeAsync`, preventing local-only rooms and misleading `找不到此房間` errors when Firestore rejects the request.
- Waiting rooms are readable before membership is added; joining remains restricted to appending the caller's own UID. Rules were deployed to `happinessflow-online`.
- Waiting players may read only their own saved player document before joining; other player documents remain protected.
- Validation: `npm run typecheck`, Firestore permission tests (10 passed), `npm run build`, and scoped diff checks passed.

## Return players to lobby when room closes

- When the coach deletes a room, the room listener clears the player's room state. `LobbyView` now also closes its local room modal state when that room disappears, preventing an empty overlay from covering the lobby.
- The `room_waiting` route is included in the no-room redirect guard, so developer or restored waiting-room routes also return to the lobby after closure.
- The room listener now clears the stale `hf_practice_mode` flag when the room is deleted, membership is removed, or the room listener loses access; this prevents the practice-mode bypass from blocking the lobby redirect.
- `closeRoom` now awaits `deleteDoc` directly instead of swallowing a failed delete, and only clears the coach's local room after Firestore confirms deletion.
- Validation: `npm run typecheck` and `npm run build` passed. Build output contains only existing Tailwind/chunk-size warnings.
- Live multi-account close-room replay remains the final browser verification step.

## Nonexistent room message

- Room reads now allow an authenticated user to receive an empty snapshot for a missing room instead of a rules `permission-denied`; no existing room data becomes readable through this path.
- Join flow now reports `此房間不存在` when the room document is absent.
- Added a Firestore rules regression test for missing-room reads.
- Deployed the updated rules to Firebase project `happinessflow-online`.
- Validation: rules tests 11 passed, typecheck passed, production build passed, and `git diff --check` passed.

## Start game button no response

- `startRoomGame` no longer wraps the critical start transaction in `safeAsync`, which had swallowed Firestore failures without updating the UI.
- Missing-room and non-host conditions now return visible errors; successful starts immediately update the local room status to `playing` while the listener syncs the full room state.
- Replaced the start-game Firestore transaction with a latest-room read plus one batch commit, avoiding the SDK transaction stream that could remain pending and make the button appear unresponsive.

## Coach readiness stuck after player setup

- Main routing read `room.publicPlayerStates` to decide whether the coach should leave the waiting screen, but that field was missing from the effect dependencies.
- Added the dependency so the coach route re-evaluates when a player finishes profession, enterprise, and dream selection.
- The remaining monitor spinner came from a missing private player document, not the coach route. Completed setup now syncs immediately whenever the room still lacks the private financial state or public setup projection, while normal game updates keep their debounce.
- Player sync failures are now visible in the game UI instead of being swallowed by `safeAsync`.
- Added a Firestore Emulator regression that publishes completed setup and private state in the same batch; rules tests pass 12/12.
- Validation: `npm run test:rules`, `npm run typecheck`, `npm run build`, and a clean browser reload passed.
- Known risk: a live two-account room replay is still needed because the available browser tabs currently share the same GM login and are back in the lobby.

## Player sync undefined and dice quota symptom

- `toPublicPlayerState` now removes optional `undefined` fields before any Firestore write. This covers player sync, dice, movement, and card transactions through the shared helper.
- Added a regression test for the public projection shape.
- Validation: focused board/state tests 9 passed, Firestore rules tests 12 passed, typecheck passed, and production build passed.
- If Firebase still returns a literal `Quota exceeded` after a fresh reload, the project service quota must reset or be increased; the client cannot bypass that server-side limit.

## H013 family milestone card and player card drawer

- H013 player metadata now keeps the base title `幸福家庭的重要歷程`; the current family stage remains a separate player-facing field.
- Projection family-milestone content now scrolls inside the card so the introduction, stage costs, and status label are not clipped by the fixed card height.
- Player card drawers now support `收起卡片` / `展開卡片`. Collapsing only hides the card UI and keeps the card event pending, allowing the player to open credit or sell assets from the game action dock before returning to the card.
- Validation: `npm run typecheck`, 31 focused Vitest tests, `npm run build`, and `git diff --check` passed.

## Financial navigation placement

- The player game page now renders the `報表／金流／紀錄` switcher inline between the current-turn header and the income statement. Other financial-report views keep the original floating placement.
- Validation: `npm run typecheck`, 6 focused Vitest tests, `npm run build`, and `git diff --check` passed.

## Promotion dice polish

- Promotion and lifelong-learning dice now use explicit pip coordinates, one shared random-value source, and a restrained bounce animation instead of stacked spin, float, shimmer, and modal pulse effects.
- The roll surface is now an accessible button with Chinese status copy and a clear `點擊骰子開始` prompt.
- Validation: `npm run typecheck`, focused DiceFace and GameView tests, `npm run build`, and `git diff --check` passed. Browser-driven visual inspection was unavailable because the local browser-control runtime could not initialize; live exam replay remains the final visual check.

## Promotion result modal fit

- The promotion result modal now has a viewport-relative maximum height and internal scrolling, with smaller mobile padding and result-card spacing so the success details and close button stay reachable on short screens.
- Validation: `npm run typecheck`, 3 focused tests, `npm run build`, and `git diff --check` passed.

## H026 child eligibility

- H026's `requires_child_count_1` condition is now mapped into the happiness card model and enforced by the board-card action resolver.
- Players with no children now receive only a `關閉` action because the card has no effect; players with at least one child retain the existing `接受` / `不接受` flow and financial check.
- Validation: `npm run typecheck`, 30 focused tests, and `npm run build` passed.

## Player and projection sync latency

- Player private-state sync still writes the full private player document, but only updates `publicPlayerStates` when a public projection field actually changes. Financial-only changes no longer wake the projection screen or cause it to rerender from an unnecessary room-document update.
- Removed the player's duplicate room listener for market updates. Market changes now use the room snapshot already maintained by `RoomContext`, avoiding a second listener and repeated listener rebinding after each market timestamp update.
- Validation: `npm run typecheck`, 31 focused tests, `npm run build`, and `git diff --check` passed.
- Remaining check: replay one player plus projection window and confirm dice, movement, card reveal, and market update latency under the current emulator/network setup.

## Room creation stuck on loading

- Room-code lookup and room creation now have a 10-second timeout. A failed or unreachable Firestore connection no longer leaves the create modal stuck on `建立中...`; the existing error handler shows a usable connection error and resets the button.
- Normal room creation behavior is unchanged. Local Playwright replay with the seeded coach account successfully created a waiting room.

## Login and room creation spinner recovery

- The shared root cause was a hung orphaned Firestore Emulator process: port `8080` remained open, but document requests produced no response for more than 3 seconds. Vite and Auth Emulator were healthy.
- Preserved the local Auth accounts, stopped the stale emulator processes, and restarted Auth plus Firestore together. Re-seeded the four fixed local test users so the coach role document was restored.
- Post-restart health check: Vite and Auth responded in about 0.002 seconds; Firestore responded in about 0.09 seconds instead of timing out.
- Browser verification passed: the seeded coach logged in without console errors and created board-game room `104398`, reaching the waiting-room screen.

## Coach-controlled board start gate

- `room.status === 'playing'` only means players may enter setup; it does not prove the coach has pressed the monitor's central start button.
- Board action availability and the authoritative dice mutation now also reject rolls while `room.isTimerPaused === true`. The player sees `請等待執行師開始或繼續遊戲` until the coach starts the timer.
- No new start flag was added; the existing room timer state remains the source of truth.
- Validation: focused experience-state tests passed 4/4, `npm run typecheck` passed, `npm run build` passed, and scoped `git diff --check` passed.

## Pause-turn execution and projection notice

- Fixed the shared turn scanner: it no longer changes both the base index and offset after encountering a paused player. Two-player and three-player rooms now skip the correct player and decrement the counter exactly once.
- Turn changes now store a short `skippedTurnNotice` with the skipped player UIDs and next player. The projection shows a 2.6-second pause-turn message before revealing the next current-turn name.
- Completed the card write paths for every card with `missRounds`: C001-C008 move to school, C035-C037 move to hospital, and C039 moves to the repair shop; all write the pause count through `moveCurrentPlayerToSquare`.
- Hospital and repair board-square events continue to commit their pause count when the event is completed. `boardState.skipTurns` remains the single authoritative counter.
- Validation: focused turn/card tests passed 30/30, `npm run typecheck` passed, `npm run build` passed, and `git diff --check` passed.

## Purchase card without a saleable asset

- Shared purchase-card prompts now disable `進入出售` when the player has no matching sale candidates; `放棄` remains available to complete the prompt.
- The existing handler-side empty-list guard remains as a second safety net.
- Validation: focused board-card tests, typecheck, build, and diff check passed.

## C045 source player shared prompt

- Shared-card target construction now explicitly includes the card-drawing player, even if that player's member record is temporarily missing from the local member snapshot.
- The player view also accepts the prompt by `sourcePlayerUid`, so the source player receives the same C045 expense-adjustment window as other players.
- Validation: focused board-card and room-context tests, typecheck, build, and diff check passed.

## N027 no-stock player shared prompt

- Players without matching stock holdings no longer auto-submit `no_effect` and close the N027 shared prompt during render.
- The prompt remains visible so the player can explicitly choose `關閉`; players with holdings keep the existing financial-check flow.
- Validation: focused board-card and room-context tests, typecheck, build, and diff check passed.

## Shared prompt keeps source card visible

- The source player's card drawer is no longer closed when a shared prompt opens; the prompt appears above the card.
- Existing completion flow still closes the card after all shared responses and financial processing finish.
- Validation: focused board-card, room-context, and experience-state tests, typecheck, build, and diff check passed.

## All purchase cards shared prompt reliability

- The source player now marks a newly opened shared prompt visible immediately instead of waiting only for a later room snapshot effect.
- A stale local shared-prompt snapshot can no longer override a newer room prompt; cleared room prompts also clear the local snapshot.
- Data-driven coverage confirms all 26 purchase cards C009-C034 resolve to `asset_sale` and are classified as shared events.
- Validation: 37 focused tests, typecheck, build, and diff check passed.

## Family milestone source-card ownership

- Family milestone join rolls no longer advance or clear the source player's board event. The drawing player keeps control of the card until they explicitly finish it.
- A successful shared roll remains incomplete until that player accepts or declines the resulting family action; failed and declined rolls complete immediately.
- The completion guard is shared by all 14 family milestone cards rather than hard-coded for H011.
- Validation: 35 focused tests passed, `npm run typecheck` passed, `npm run build` passed, and `git diff --check` passed.

## Coach investment-income adjustment

- Added monthly investment-income decrease/increase controls beside the existing coach cash adjustment controls.
- Coach adjustments write to the player's private `income.investment` field and reject reductions below zero.
- Manual investment income is included once in passive income and appears as `執行師調整` in the financial statement.
- Validation: 8 focused tests passed, `npm run typecheck` passed, `npm run build` passed, and `git diff --check` passed. Live coach-room interaction remains unverified because no active coach room tab was available.

## Compact mobile financial check

- Reduced the financial-check modal width, header, prompt, footer, spacing, and control sizes for phone screens.
- Removed the fixed 240px empty area from every financial category; the 2x2 board now sizes to its selected content.
- Overflow remains available only as a safety fallback when a category contains many selected entries.
- Validation: financial-check tests passed 5/5, `npm run typecheck`, `npm run build`, and `git diff --check` passed.

## Mobile digital banking app

- The banking app now uses a full-screen phone layout with compact safe-area header, pinned cash row, four-column tab bar, and independently scrolling content.
- Stock cards use a two-column phone grid; loan, insurance, deposit, and vehicle panels use reduced mobile spacing, typography, cards, and controls while retaining desktop sizes at `sm` and above.
- Added an accessible close label and bottom safe-area padding; transaction behavior is unchanged.
- Validation: React best-practices review, `npm run typecheck`, `npm run build`, and `git diff --check` passed.

## Native number spinners

- Hid browser-native number input spinner controls globally; app-specific increment/decrement buttons remain unchanged.
- Validation: `git diff --check` and `npm run typecheck` passed.

## Compact stock trade action

- Removed the large stock trade summary container and replaced it with a compact total amount row and action button.
- Buy mode shows `購買總金額` and `購買`; sell mode keeps the corresponding sell action.
- Validation: `git diff --check` and `npm run typecheck` passed.

## N009 market sync loading

- Fixed the market-sync effect cancelling its own request when loading state changed, which left the N009 action stuck on `同步行情中...`.
- Success and failure now both clear the loading state.
- Validation: `git diff --check`, `npm run typecheck`, and `GameView.test.ts` passed.

## Batch stock financial check

- Consolidated batch stock purchases into one `股票` asset entry in financial checks instead of one entry per ticker.
- Transaction impacts and stock holdings still retain each ticker and amount as detail.
- Validation: `git diff --check` and `npm run typecheck` passed.

## H020 family source card visibility

- Removed automatic source-card completion when the last family milestone participant finishes responding.
- After the source player completes their own action, the card stays visible as `等待其他玩家完成`; once all responses finish, the source player explicitly presses `完成卡片`.
- The fix applies to every family milestone card, not only H020.
- Validation: 39 focused tests, `npm run typecheck`, `npm run build`, and `git diff --check` passed. Live multiplayer verification remains pending.

## Legacy room player sync permissions

- Firestore rules now treat a missing legacy `publicPlayerStates` field as an empty map while still allowing players to change only their own public projection.
- This prevents the player sync batch from falling through the room update rule and reaching the 1000-expression limit.
- Added a regression test for private player state plus public projection sync against a legacy room document.
- Validation: Firestore room permission tests passed 14/14 against the active emulator.

## Family milestone rejection unlocks end turn

- When the drawing player rejects H012 or another family milestone card, the matching family join prompt is cancelled and the board event advances immediately.
- Only the source player can use this path; other players and unrelated shared prompts remain blocked from early dismissal.
- Validation: focused family-card, room-context, and turn-state tests passed 41/41; typecheck and diff checks passed.

## Coach emergency board recovery

- Added `解除目前事件` and `強制結束回合` to the coach flow panel with confirmation dialogs.
- Both commands clear current card/event queues, movement, shared prompts, and stale player pending actions without reverting completed financial changes.
- Clear-event preserves the current player and roll state; force-end uses the existing skip-turn-aware next-player calculation.
- Validation: focused room and turn-state tests passed 10/10; typecheck, production build, and diff checks passed.

## H016 family milestone source completion permission

- Fixed Firestore rules so the current family-milestone source player can remove their matching family prompt and complete the board event after accepting or rejecting the card.
- The permission is tied to the current event ID, source card prompt, source player UID, and current turn; invited non-source players remain denied.
- The fix applies to all family milestone source cards rather than hard-coding H016.
- The player UI now marks the card handled only after the backend confirms dismissal; failed writes keep the card retryable instead of closing it locally.
- Fixed the remaining player-side guard so an explicit `不接受` from the source player reaches that backend path even while family participants are pending. Normal accepted-card completion still waits for participants.
- Validation: Firestore room permission tests passed 15/15; latest focused family, player-view, and room tests passed 39/39; typecheck, production build, and diff checks passed.

## Target enterprise financial check entries

- Target enterprise purchases now provide explicit financial check entries for cash decrease, `目標企業（名稱）` asset increase, and `企業收益` income increase.
- Target enterprise and dream purchases now provide completion impact summaries, so their transaction-complete screen matches the other transaction flows.
- The existing enterprise asset model and monthly income calculation remain unchanged.
- Validation: target/dream transaction regression tests, typecheck, production build, and diff checks passed.

## Projection city map visual refresh

- Added the foundation-only city map asset at `public/assets/projection-map/life-city-foundation.png` with its generation prompt beside it. Runtime-controlled tiles, labels, tokens, and HUD remain separate.
- Reworked the projection layout from a 14x14 square ring to a 16x12 rectangular ring while preserving the existing 52-square index order and game state contracts.
- Added live central landmark labels for residential, growth, wellness, family, finance, and dreams areas, plus a dark teal projection HUD that matches the new warm city palette.
- Validation: `npm run typecheck`, `npm run build`, and `git diff --check` passed. Source unit tests passed 21 suites / 112 tests. Full Vitest invocation still reports two pre-existing Playwright E2E loading/configuration failures.
- Risk: live projection screenshot verification needs an authenticated Firestore emulator session because the current rules deny unauthenticated room reads.

## Main-map background music

- Added a 120-second AAC/M4A background track at `public/audio/happinessflow-bgm-main-map.m4a` for the projection main map, using the approved city-stroll and warm wooden tabletop direction.
- Extended the existing native audio manager with looping background music, shared volume settings, autoplay-retry handling, and cleanup on projection unmount.
- Projection starts the music on load when allowed, retries on the first pointer or keyboard interaction, and stops/resets when leaving the map.
- Validation: `npm run typecheck`, `npx vitest run src/utils/audio.test.ts`, `npm run build`, and `git diff --check` passed. Audio metadata confirms a 120-second stereo AAC track.
- Risk: browser autoplay policy still determines whether sound starts before the first user interaction.

## Projection card editorial redesign

- Replaced the narrow projection card with a 16:9-style horizontal event stage: editorial story panel on the left, structured impact panel on the right, and a fixed status bar.
- Added three shared WebP collage assets for happiness, news, and opportunity cards. The assets contain no readable text, UI, bees, honeycombs, or insect motifs; total runtime size is about 533KB.
- Replaced 3D card flipping with a cover-slide reveal and `AnimatePresence mode="wait"`, preventing old and new card content from rendering together and producing text ghosts.
- Kept real-estate, stock-news, and family-milestone information branches. N045 now fits all seven fixed financial fields above the status bar at 1366×768.
- Validation: `npm run typecheck`, projection Vitest (11 tests), full three-player projection E2E, `npm run build`, and `git diff --check` passed.
- Risk: final projector color calibration should still be checked on the target hardware.

## Projection sound effects

- Extended the existing native Web Audio cue set with movement steps, special-square landing, shared prompt, pause-turn, and sync-warning sounds.
- Projection playback is driven by existing movement, event, card reveal, shared prompt, skipped-turn, and sync-state IDs; Firestore rerenders do not replay the same cue.
- Projection now unlocks Web Audio together with the existing BGM autoplay retry, so the first user interaction enables both music and effects.
- Validation: `npm run typecheck`, `npx vitest run src/utils/audio.test.ts`, `npm run build`, and `git diff --check` passed.
- Risk: final sound balance still needs verification on the actual projection speakers with Coach narration.

## P1 board movement sound effects

- Kept the existing per-step movement cue and added a normal landing cue for movement legs that finish without a special event.
- Replaced the shared special-square cue with distinct bank, school, hospital, and repair landing cues.
- Special landing playback uses `currentEvent.id`; movement and normal landing playback use `movement.startedAt` plus the path step, preventing Firestore rerenders from replaying audio.
- Validation: `npm run typecheck`, `npx vitest run src/utils/audio.test.ts`, `npm run build`, and `git diff --check` passed.
- Risk: final balance still needs one real projection replay across all four special squares.

## Projection audio autoplay recovery

- Fixed one-shot cues being marked as played before `AudioContext` was actually running; failed playback no longer consumes the event ID.
- Added a projection audio toggle that explicitly unlocks Web Audio and starts the main-map BGM from a user gesture when browser autoplay blocks initial playback.
- The toggle follows the existing `hf_audio_settings_v1` preference and updates when the shared audio setting event changes.
- Validation: `npm run typecheck`, `npx vitest run src/utils/audio.test.ts`, `npm run build`, and `git diff --check` passed.
- Risk: browser policy still requires the projection operator to click `啟用音效` when autoplay is blocked.

## Projection audio control placement

- Moved the projection audio control into the existing top HUD so it no longer overlays the central event stage.
- The top-right area now contains only the card-log control; audio state remains visible and clickable in the HUD.
- Validation: `npm run typecheck`, `npm run build`, and `git diff --check` passed.

## Dice sound polish

- Replaced the electronic square-wave dice cue with five irregular filtered noise impacts and a soft settling tone, matching a warm tabletop dice roll.
- Kept the existing Web Audio unlock, mute preference, and event timing unchanged; only the `dice` cue rendering changed.
- Validation: `npm run typecheck`, `npx vitest run src/utils/audio.test.ts`, `npm run build`, and `git diff --check` passed.
- Risk: final loudness and realism still need a live browser replay through the actual player/projection speakers.

## Player-side visual redesign

- Added the presentation-only `PlayerModalFrame` and applied the warm city palette to player HUD, turn controls, card drawer, financial check, banking, medical, promotion, payday, family/shared event, happiness, and real-estate surfaces.
- Kept Room, BoardState, Firestore writes, transaction builders, card action resolution, and existing callbacks unchanged. Player card content still directs players to the projection screen instead of showing full descriptions or impact summaries.
- Improved mobile layout boundaries: modal content scrolls inside the panel, actions stay visible, card log moves below the player action dock on small screens, and reduced-motion disables decorative animation.
- Validation so far: `npm run typecheck` passed after the shared frame, financial surfaces, banking surface, and event surface changes. Full build and focused tests remain to be run.
- Risk: final visual verification still needs authenticated player-session screenshots at the four requested viewport sizes.

## Player warm-theme contrast correction

- Fixed scoped warm-theme overrides that could place white text on cream inputs or dark text on green primary buttons.
- Added one shared `player-card-actions` scope so card choices, investment inputs, and asset-sale details use the same paper, ink, gold, success, and error colors as the card drawer.
- Darkened small muted and amber labels to meet readable contrast on cream surfaces while leaving projection and login styling untouched.
- Validation: typecheck, focused player tests, production build, and a signed-in local browser smoke check are required after this correction.

## Player visual consistency pass

- Unified leave-room, forced-payment, and hospital flows with the existing warm player modal frame without changing their callbacks or game-state behavior.
- Removed remaining purple and neon-blue states from promotion dice, goal purchases, digital-bank products, cash-flow labels, and transaction history.
- Updated the player lobby to the deep-teal, cream, gold, and semantic accent palette; removed the bee fallback avatar and inconsistent English subtitles.
- Validation: `npm run typecheck`, `npx vitest run src/views/game/GameView.test.ts`, `npm run build`, `git diff --check`, and a signed-in desktop lobby browser check passed.
- Risk: event modals still need a live multiplayer replay because the browser check covered the signed-in lobby rather than every board-event state.

## Career and happiness modal color correction

- Replaced the legacy dark career-rank popup with the shared warm player modal frame and clear current, unlocked, and locked rank states.
- Removed the nested background from the happiness list and aligned all checked, icon, and detail colors to the shared happiness coral palette.
- Validation: `npm run typecheck`, `npm run build`, and `git diff --check` passed.

## Happiness list surface correction

- Removed the legacy shared dark `Card` background that was overriding the warm happiness list surface.
- Locked items now stay readable on warm cream cards; only the checkbox and lock badge communicate the locked state instead of dimming the whole row.
- Child milestones use a fixed indent without scale or opacity changes.
- Validation: `npm run typecheck`, `npm run build`, and `git diff --check` passed.

## Settings menu opacity correction

- Changed the player settings dropdown to a solid cream surface and removed backdrop transparency so the game HUD cannot show through it.
- Kept the existing menu actions and updated the developer-settings hover state to the warm palette.
- Validation: `npm run typecheck` and `npm run build` passed; existing Vite warnings remain unrelated.

## Settings menu stacking correction

- Raised the player HUD stacking context above the current-turn prompt and assigned the settings dropdown its own higher layer.
- Kept the current-turn prompt visible below the menu while preserving pointer and touch interaction on the menu.
- Validation: `npm run typecheck` and `git diff --check` passed.

## Player financial tabs and card log

- Renamed the player financial navigation to `財務報表`、`現金流量表`、`交易紀錄`.
- Added `卡片日誌` as the fourth tab in the player board game view, using the existing `room.boardState.cardLog` data.
- Added an inline card-log presentation so the player view no longer opens a separate overlay; projection and history views keep their existing behavior.
- Validation: `npm run typecheck`, `npx vitest run src/components/board/BoardCardLogPanel.test.tsx`, `npm run build`, and `git diff --check` passed.
- Risk: final visual spacing should still be checked in an authenticated player session on a narrow phone viewport.

## Player financial tabs spacing

- Moved the player financial tabs up by 16px so they sit closer to the current-turn container.
- Validation: `npm run typecheck` and `git diff --check` passed.

## iPhone bottom safe-area correction

- Removed duplicate bottom safe-area padding from the player game root, action-dock wrapper, and waiting-room wrapper.
- The player action dock now keeps one non-additive Home Indicator clearance using `max(0.5rem, env(safe-area-inset-bottom))`.
- Standalone iPhone mode now uses `window.innerHeight` so the app background reaches the physical screen bottom; regular browser mode still follows `visualViewport.height`.
- Root viewport measurements confirmed the page already fills the screen; the remaining visible cutoff was the mismatched document/PWA background behind the iPhone Home Indicator.
- Document, theme, and manifest backgrounds now consistently use `#102f38`, with manifest cache version `v8`.
- Validation: `npm run typecheck`, `npm run build`, and `git diff --check` passed.
- Live follow-up: fully close and reopen the installed iPhone app, then confirm the bottom dock no longer leaves an oversized blank band.
- Replaced the mixed iPhone viewport calculation with the known working layout pattern: fixed document/App shell, native `100dvh`, no `viewport-fit=cover`, and no JavaScript viewport-height variable.
- The player action dock now uses a fixed bottom offset instead of safe-area padding. A `390x844` check confirmed every root layer reaches exactly `844px`.
- Raised the game tutorial overlay above `GameHeader` (`z-[10060]` vs `z-[120]`) so the opening tutorial is not covered by the top HUD.

## Tutorial and settlement surface correction

- Replaced the remaining dark full-screen tutorial, player settlement, inline settlement, and projection settlement backgrounds with the shared warm cream surface.
- Recolored the tutorial modal's embedded mock UI surfaces, borders, and text inside a scoped warm-preview region; semantic red and green buttons keep white labels.
- Forced the tutorial and player settlement cards to override the shared `Card` component's dark default background.
- Made the player settlement card the single vertical scroll owner and removed the nested score-detail scroll area.
- Removed the `GameView` root `touch-none` rule that prevented settlement scrolling on touch devices; normal game content keeps its existing `touch-pan-y` behavior.
- Validation: 9 focused tests passed, `npm run typecheck`, `npm run build`, and `git diff --check` passed.
- Risk: final iPhone verification should confirm the total-score and action area can be reached in a real completed game.

## Player utility dialogs

- Restored monthly cashflow, target and dream, digital banking, and medical screens as centered dialogs on mobile instead of full-screen pages.
- Target and dream purchase confirmation keeps the same dialog presentation after choosing an item.
- Dialog content remains internally scrollable on short screens; transaction and event callbacks are unchanged.
- Validation: focused modal and GameView tests 3/3, `npm run typecheck`, `npm run build`, and `git diff --check` passed.

## Player card back alignment

- Updated the player board-card back to match the projection card cover: deck editorial art, teal overlay, white inset frame, deck icon, deck name, and waiting-for-reveal label.
- Kept the existing card flip, reveal callback, and action flow unchanged.
- Validation: `npm run typecheck`, focused card/game tests, `npm run build`, and `git diff --check` passed.

## Player notification surface

- Unified transient and persistent player notifications with the warm modal language: cream surface, gold border, teal text, and semantic success/error/info accents.
- Persistent notifications keep the existing acknowledgement button and transient notifications keep the existing auto-dismiss behavior.
- Raised the notification layer above player dialogs so synchronization and action errors remain visible.
- Validation: 10 focused tests, `npm run typecheck`, `npm run build`, and `git diff --check` passed.

## Two-dice board roll flow

- Returned the authoritative `dice` array from `rollBoardDice` so the player UI can render both rolled dice instead of displaying only the sum as one die.
- Kept the server-authoritative total and movement path unchanged; projection now shows `die 1 + die 2 = total` when two dice are used.
- Synchronized the player dice animation duration with the board movement intro delay (`3500ms`) to avoid the player UI advancing early.
- Added a legacy fallback for rooms whose historical `lastRoll` has no dice array.
- Validation: typecheck passed; focused tests, production build, and `git diff --check` are next.

## Dice 3D landing correction

- Removed the landing-only flat result face; every die now keeps all six faces throughout rolling and landing.
- The authoritative result is assigned to the visible front face after the landing rotation resets, preserving the 3D cube silhouette.
- Validation: focused tests 10/10, typecheck, production build, and `git diff --check` passed.

## Cash-event and insurance repair pass

- Credit capacity is now `work income × 10`, calculated from outstanding credit principal plus legacy credit balance. Real-estate, business, and car loans do not consume this credit capacity.
- Credit borrowing is guarded in both the banking UI and the authoritative game transaction handler; repayment restores the available capacity.
- Player profession, enterprise, and dream selections now persist as a local draft and are restored only after private player-state hydration, preventing a mobile tab switch from restarting setup.
- Family milestone responses and action cleanup now return success/failure. The player UI only marks the action complete after Firestore cleanup succeeds, and direct happiness rewards carry an idempotent action key to prevent duplicate rewards after retry.
- Projection family milestone summaries now show only the introduction and stage costs/happiness; the current-stage label remains player-side only. The stage table scrolls inside its card.
- Large-enterprise shared investment input keeps the exact entered amount, validates the million-unit step, and no longer resets from a stale cash snapshot. Shared batch stock sales use one generic `股票` financial-check entry.
- Removed the generic enterprise option from financial-check asset categories.
- Added house and car insurance purchase actions in the bank. House insurance targets all uninsured houses in one transaction; car insurance updates eligible car/vehicle assets and both feed the existing monthly insurance calculation.
- Property repair fees are calculated per eligible uninsured rental property, with a fallback to all uninsured properties for legacy states. Hospital fees, repairs, board-card payments, promotion fees, and lifelong-learning fees now share the cash-shortfall recovery path for stock/asset sale, credit borrowing, or forced debt.
- The public projection guard now handles rooms missing `publicPlayerStates` without evaluating an undefined field, addressing the previous player-sync permission failure.
- Validation: `npm run typecheck`, `npx vitest run src` (26 files, 128 tests passed; rules suite skipped without emulator), `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx vitest run src/test/roomPermissions.test.ts` (15 passed), `npm run build`, and `git diff --check` passed. A plain `npm test -- --run` still incorrectly collects Playwright files under `e2e/`; use the scoped Vitest command for source tests.

## Coach game-flow controls

- Added `重複目前事件` to re-trigger the current board event for the player, with a confirmation warning and guards for active movement/shared prompts.
- Added `選擇下一回合` to let the coach choose an active player after the current flow is clear.
- Validation: `npm run typecheck`, `npx vitest run src/context/RoomContext.test.ts src/test/roomPermissions.test.ts src/views/board/boardProjectionStatus.test.ts` (6 passed; rules suite skipped), and `git diff --check` passed.

## H016 family milestone recovery and approval

- Persisted the source stage and source-action completion inside `familyMilestoneJoinPrompt`, so a pending H016 event no longer recalculates to the next stage after reload.
- Family join dice now chooses one authoritative result before animation, blocks rapid duplicate submissions, and excludes members marked as left from the waiting list.
- Added the existing `pendingRequests` approval path for source-player family milestone acceptance; coach approval is required before financial checking.
- Validation: `npm run typecheck`, `npm test -- --run src` (26 files, 131 passed; 15 rules tests skipped in the default run), `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npx vitest run src/test/roomPermissions.test.ts` (15 passed), `npm run build`, browser smoke load, and `git diff --check` passed.
- Known risk: existing rooms created before this change have no persisted source-stage snapshot; validate new H016 rooms first, then add a recovery command if legacy-room migration is required.

## 2026-08-19 13-item封測流程修正

- Request processing now uses an event-scoped execution key instead of treating the player UID as the processed key. Story and board-share requests carry `boardEventId`.
- Family milestone prompts remain authoritative until source completion and every eligible participant response is complete. Stale family snapshots are discarded when the remote prompt disappears or changes.
- Shared target UIDs are calculated inside board transactions from the latest active room members; left players are excluded.
- Dice entitlement and startup-upgrade state read the latest private player document in the transaction. Store acquisition cards use `100 + purchasePercent` pricing.
- Market listings use latest-snapshot transactions and return an explicit conflict result. House insurance is now purchased one property per policy at 2,000 monthly.
- Validation: source unit tests 137 passed, Firestore rules emulator 15 passed, `npm run typecheck`, `npm run build`, and `git diff --check` passed. Plain full Vitest still collects Playwright files under `e2e/` and reports two pre-existing harness failures.

## 2026-08-20 7-item登入與幸福歷程同步修正

- Auth now uses `browserSessionPersistence`, so separate browser tabs can keep separate test accounts. Login, registration, and redirect initialization wait for the persistence promise.
- GameContext resets local game/session state on UID changes and blocks automatic player sync until the private state is hydrated, the user is still a room member, and the auth UID is unchanged.
- GameView rejects family/shared prompts whose event or card does not match the current board event. Coach room recovery transactionally removes stale prompts, matching pending actions, and same-event pending requests.
- Family source actions remain authoritative until the source player and every eligible participant complete; stale local snapshots cannot close or replace a newer remote event.
- Validation: same browser context with three player tabs passed; existing 3-player room join/setup/start/projection regression passed; source Vitest 138 passed with 15 rules tests skipped in the default run; Firestore emulator rules 15/15 passed; `npm run typecheck`, `npm run build`, and `git diff --check` passed.
- Remaining risk: all seven reported scenarios were not replayed end-to-end with real user actions in this pass; next safest task is browser regression for H016 approval, shared responses, refresh, and concurrent dice.

## 2026-08-20 雙骰拋擲動畫優化

- `GameActions` now keeps the roll button fixed and gives each die its own Framer Motion controller, lateral trajectory, rotation direction, height, and bounce.
- Double rolls land side by side without changing dice rules, authoritative totals, movement distance, `translateZ` geometry, or the 3500ms board synchronization delay.
- Result faces stay on the placeholder while the dice are airborne and are fixed only at the first landing; the landing controller stops before the idle rotation is applied, preventing a second rotation jump.
- Added `GameActions` regression coverage for two dice, one die, 3500ms single completion, and recovery after a failed roll.
- Validation: focused tests 5/5, `npm run typecheck`, `npm run build`, and `git diff --check` passed.
- Browser login was available at localhost, but an authenticated game room was not available for a final desktop/mobile visual replay; use a fresh room for the final visual check.

## 2026-08-20 family milestone per-player stage progression

- Fixed the family milestone rule so every player independently advances through the five ordered stages; the drawing player can choose directly, while other players must roll at least 4 before choosing to participate.
- Persisted the qualifying participant's own `stageProgressId` in the transaction response and pending action, so a later reload or source-player update cannot switch that participant to another player's stage.
- Passed rolls now close the dice result immediately and expose the participant choice. Failed rolls retain the existing result feedback delay.
- Remote private state is authoritative: a missing pending action is cleared locally instead of being resurrected from stale state. No pending action is created after all five stages are complete.
- Validation: focused tests 55/55 passed, Firestore rules emulator 15/15 passed, `npm run typecheck`, `npm run build`, and `git diff --check` passed.
- Known risk: no real three-account browser replay was performed for concurrent rolls plus refresh; use a fresh room for the final H016 regression.

## 2026-08-20 財務加速器第一版

- `rooms/{roomId}.financialAcceleration` 成為房間唯一倍率來源，支援 `×1／×1.5／×2／×3`；舊房間與未設定房間自動使用 `×1`。
- 月結、理財收入、薪資、定存、企業／兼職收入、租金與財務自由摘要套用倍率，支出與資產價值不放大。
- 一次性現金收益改用 `incomeMultiplierEligible` 明確標記；借款、出售、理賠、退款與全體補助不套用。交易紀錄保存原始金額、倍率與實際入帳金額。
- 執行師端新增倍率確認、最後修改者／時間、一次性全體補助；補助使用房間交易鎖定，每位有效玩家只入帳一次，遊戲結束後拒絕修改。
- 玩家端只顯示目前倍率與通知，沒有修改入口；財務報表明細與歷史／現金流紀錄同步顯示加速後數值。
- Firestore 規則新增倍率與補助的執行師限定欄位驗證。
- 驗證：`npx vitest run src`（28 files、150 passed、17 skipped）、`FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx vitest run src/test/roomPermissions.test.ts`（17/17 passed）、`npm run typecheck`、`npm run build`、`git diff --check` 通過。
- 注意：`npm test -- --run` 仍會誤收集 `e2e/` 的 Playwright 檔案；`npm run test:rules` 因 8080 已有既存 emulator 而無法接管，改連線該 emulator 完成規則驗證。
- 下一步：建立新測試房，用執行師與至少兩個玩家實際驗收切換倍率、月結、股利／卡片獎勵與全體補助後重整／重連。

## 2026-08-21 切回雲端 Firebase 與 production 部署

- `dev/.env.local` 已改為 `VITE_USE_EMULATOR=false`；本地 Vite 重啟後會使用 `happinessflow-online` 的雲端 Firebase，不再連接本地 Firestore/Auth Emulator。
- Production deployment `dpl_9vfnEyho56HgDt2356C1zTpgaTJT` 已部署至 `happinessflow-online.vercel.app`，狀態 Ready。
- 驗證：正式網址 HTTP 200、頁面標題為「第二人生」、首頁無 Vite error overlay 且沒有瀏覽器 console error。
- 本機 Firestore emulator 仍可能由既有測試程序監聽 8080，但目前應用程式設定不會使用它；Auth emulator 已停止。

## 2026-08-21 v2.3 更新與 production 部署

- 對外版本號更新為 `v2.3`，執行師端系統更新日誌新增本次多人同步、交易一致性、幸福歷程恢復、計時器與房間生命週期修正內容。
- 驗證：`npm run typecheck`、`npm run build`、`git diff --check` 通過；正式站登入頁顯示 `V2.3`，HTTP 200，無 Vite error overlay 或瀏覽器 console error。
- Production deployment `dpl_BhShNqZhH6ZLNpzYFSJ1WUiXwZ5h` 已部署至 `happinessflow-online.vercel.app`，狀態 Ready。

## 2026-08-21 線上測試 10 項異常修正

- `runRoomBoardMutation` 不再把讀取到但未變更的玩家私有資料整份寫回，避免企業貸款、定存、幸福點與其他財務結果被舊快照覆蓋。
- 房市購買改為同一個 Firestore board transaction 同時確認庫存、建立資產／貸款／幸福項目／交易紀錄並移除公告物件；多人競買只有第一筆成功。
- 企業升級待辦只更新 `pendingStartupUpgradeAction` 欄位，不再以舊玩家快照覆蓋剛完成的企業貸款；板卡財務操作加入事件級 operation key。
- 幸福歷程的來源完成、參與者回覆與最後結案統一依最新房間資料判定；最後完成者可結清 prompt，舊事件的本機快照／pending action 不會覆蓋新事件。
- 倒數改存開始時間基準，畫面自行計算秒數，停止每 10 秒寫入 Firestore；房間監聽加入切房／關房 token，避免上一局快照干擾下一局。
- 玩家同步錯誤保留 Firebase code 與原因，並在 UID、房間或成員資格已變更時忽略舊請求，便於判斷登入同步問題。
- Firestore 規則新增家庭歷程最後參與者結案與執行師財務設定的最小權限條件；沒有放寬一般玩家跨玩家財務寫入。

### Validation

- `npx vitest run src`：28 files、151 passed、18 skipped。
- `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx vitest run src/test/roomPermissions.test.ts`：18/18 passed。
- `npx vitest run src/context/RoomContext.test.ts src/utils/boardCardActions.test.ts src/utils/gameUtils.test.ts src/test/roomPermissions.test.ts`：59 passed、18 skipped。
- `npm run typecheck`、`npm run build`、`git diff --check` 通過。
- `npm run test:rules` 未接管 8080，原因是本機已有 Firestore emulator；改連線該 emulator 驗證規則成功。未宣稱已完成真實 6 位玩家加執行師的雲端瀏覽器回歸。

### Next safest task

- 使用新測試房完成 6 位玩家＋1 位執行師的瀏覽器回歸：企業貸款、定存月結、房市競買、幸福歷程最後一位完成、重新整理／重連與執行師開下一局。

## 2026-08-22 五項封測流程修正

- 家庭歷程五階段改由 Firestore transaction 以最新私有玩家資料原子結算，現金、幸福、prompt 完成與事件推進不再分兩次同步；重送使用事件級 command ID 防重複。
- 求婚等現金階段改由交易回傳 `applied／duplicate／insufficient／stale_event`，成功後不會再由舊本機現金顯示錯誤不足提示。
- 學校考試後抽幸福卡會驗證最新學校事件；所有事件結案恢復的分段移動統一由遠端 `movement.isActive` 安排冪等結算。
- 卡片翻牌會以 `eventId + cardId` 冪等補寫日誌；抽卡玩家自購不動產則在同一交易完成玩家財務與卡片結案，只有明確放棄才上架房市。
- 驗證：focused 67/67、source Vitest 159 passed／19 rules skipped、Firestore emulator rules 19/19、`npm run typecheck`、`npm run build`、`git diff --check` 通過；3 玩家帳號隔離與房間加入／設定／投影 Playwright 回歸通過。
- 未驗證：尚未有 6 玩家同時參與上述五種情境的瀏覽器自動化；下一步使用新房進行 6 玩家＋1 執行師人工回歸。

## 2026-08-25 六項封測同步與卡片流程修正

- Production deployment `dpl_FkgCYHqmK1rcCVDeezKMskwif9Uy` 已部署至 `happinessflow-online.vercel.app`，狀態 Ready；正式網址 HTTP 200、標題為「第二人生」，production bundle 已確認包含 2026-08-25 的 v2.3 更新日誌。
- 執行師端 `v2.3` 系統更新日誌日期更新為 2026-08-25，加入登入同步、家庭歷程權限、股市翻牌、房市上架與完整卡片日誌等對外說明。
- 房間共享快照不再清掉私人玩家狀態，避免登入完成後被反覆判定為缺少玩家資料；同步恢復成功時會清除舊的「玩家資料同步失敗」提示。
- 家庭歷程的一般玩家 transaction 只讀取自己的私人玩家文件，修正多人操作時因跨玩家讀取遭 Firestore 拒絕的同步失敗。若最後完成者不是移動玩家，執行師 listener 會以既有 transaction 冪等推進事件。
- 股市行情與更新通知改在玩家卡片翻面動畫完成後才生效，不再提前揭露卡片類型。
- 放棄不動產改為在同一個卡片結案 transaction 上架房市，移除結案後第二次寫入造成的漏上架窗口。
- 卡片結案會冪等補記當前卡片；投影與玩家日誌即使只有 1～3 筆，也可展開卡片說明與完整效果。
- 維修廠經過／停留收費符合已核准的 `REPAIR_SYSTEM.md`。現有保險規格未定義一般保養理賠，本次未擅自免除費用或發放理賠。
- 驗證：聚焦測試 17/17、source Vitest 163/163（另 19 項 rules 測試於一般 run 跳過）、既有 Firestore Emulator rules 19/19、`npm run typecheck`、`npm run build`、`git diff --check` 通過。
- 下一步：以新房進行 6 玩家＋1 執行師回歸，重播登入、多人家庭歷程最後完成者、股市翻牌、放棄房屋與卡片日誌；另由產品決定汽車保險是否涵蓋一般維修廠保養費。

## 2026-08-26 四項跨場與交易一致性修正

- 新局玩家存檔改以 `boardGameStartedAt` 對齊 `room.startedAt`；舊局快照不能跳過三步選擇或帶入幸福值，同場重連仍可恢復。
- 不動產卡所有玩家主動關閉都走明確放棄 transaction，上架房市冪等去重；購買成功維持不入房市。
- 股市通知已讀時間改為單調遞增，延遲玩家快照不能讓同一行情重複通知。
- N056-N058 創業貸款改為單一 Firestore transaction 原子建立現金、企業資產、貸款、利息、歷史、待升級狀態與共享回覆；重送不重複入帳。
- 驗證：聚焦 66/66、source Vitest 169 passed、Firestore Emulator rules 20/20、三玩家並行貸款交易、TypeScript、production build、`git diff --check` 及 Playwright 多人開局 2/2 通過。
- 保留既有 Firestore 集合與狀態邊界，未新增服務、套件、集合、延遲重試；本次未 commit、push 或部署。
- 下一步：用新房進行 6 玩家＋1 執行師人工回歸，重播同房第二局、兩種房產放棄入口、連續兩張股市卡及 N056-N058 接受／重整／經過銀行升級。

## 2026-08-26 股市新聞卡揭示順序修正

- `GameContext` 不再在股市新聞卡的公開 `currentCardReveal.isRevealed` 尚未成立時顯示行情通知；避免其他裝置的共享行情寫入繞過玩家翻牌流程。
- `GameView` 同時確認本機翻牌 transition 與遠端揭示狀態，兩者完成後才套用行情。
- 驗證：`npx vitest run src/context/GameContext.test.ts` 4/4、完整 source Vitest 170 passed／20 skipped、`npm run typecheck`、`npm run build`、`git diff --check` 通過。
- 本次未 commit、push 或部署；目前工作樹仍保留既有未提交修改。

## 2026-08-26 五項遊戲與執行師功能修正

- 家庭歷程抽卡者不再送出執行師核准請求；接受直接進入財務檢核，拒絕直接完成，普通故事分享仍走原核准流程。
- 家庭結算改用最新 Firestore 玩家資料並回傳 `applied／duplicate／requires_funding／failed`；現金不足才開啟周轉，過期事件與同步錯誤顯示具體原因，檢核答案可保留重試。
- 執行師玩家監控改為單一垂直捲動容器，移除財務報表內層捲動；未同步與未完成初始選擇都有明確狀態。
- 全體補助移除一次性限制，使用遞增 `sequence` 與 `房間＋sequence` 交易 ID；執行師可重複發放，遊戲結束與非執行師仍受限。

### Validation

- `npx vitest run src`：30 files、170 passed、20 skipped。
- Firestore Emulator rules：20/20 passed；連續補助、跳號與玩家權限案例通過。
- `npm run typecheck`、`npm run build`、`git diff --check` 通過。
- Playwright 本地頁面 smoke：390×844 與 1440×900 無水平溢出；未宣稱已完成登入後執行師手機版完整互動回歸。
- 未 commit、push 或部署；工作樹既有未提交修改均保留。

## 2026-08-26 3P＋執行師 50 回合壓力測試

- 新增 `e2e/board-50-turn-stress.spec.ts` 與 `docs/testing/BOARD_3P_50_TURN_STRESS_2026-08-26.md`。
- 修正測試啟動器避免誤接既有預覽服務，Playwright 改用 repo 內 `playwright/test` runner，並保留既有未提交功能修改。
- 本地前置檢查通過：typecheck、source Vitest 170 passed／20 skipped、build、替代 8081 Firestore Rules 20／20。
- 壓力測試實際完成 15／50 回合；第 16 回合發生 P1：卡片結案後玩家端仍顯示事件視窗，結束回合 disabled。已保存 JSON、trace 與失敗截圖。
- 因本地 P1，未執行正式站 3 回合冒煙測試、結算與第二局初始化；未 commit、push 或部署。

## 2026-08-26 七項封測問題修正

- 房市購買改用 `{ cardId, attemptId }` 與最新 Firestore 市場／玩家現金驗證；現金不足不消耗指令，直接購買抽到的不動產不會影響房市其他物件。
- 幸福歷程來源玩家的拒絕／完成等待原子結算結果，完成畫面不再只停留在本機狀態。
- 兼職工作室升級改由 `completeStartupUpgradeAction()` 單一 transaction 更新企業、收入、貸款、歷史與待辦，失敗保留流程可重試。
- 維修廠新增費用確認視窗；共享卡片改採遠端 prompt，其他流程進行中會保留待辦並提醒，完成後自動顯示。
- 驗證：source Vitest 171 passed／20 skipped、Firestore rules 20/20、typecheck、build、git diff --check；本地登入頁瀏覽器 smoke 通過且 console error 0。
- 本次未 commit、push 或部署；完整 3 玩家＋執行師多人回歸仍待新房驗證。

## 2026-08-27 v2.5 production 部署

- 已將 `dev` 工作樹的 `v2.5` 部署至 `happinessflow-online` production。
- Deployment：`dpl_7H4T7arFqD73Q5mVykuS1Js9C6yq`，狀態 `READY`。
- 正式網址 HTTP 200，production bundle 已確認包含 `v2.5`。
- 新增 `.vercelignore` 排除本機測試報告與暫存檔，避免超過 Vercel 上傳限制；未刪除任何檔案。

## 2026-08-27 開啟地圖免重複登入修正

- 根因：地圖按鈕以 `noopener,noreferrer` 開啟新分頁，阻止瀏覽器複製同源 `sessionStorage`，而 Firebase 使用分頁隔離的登入持久化，因此新地圖分頁被視為未登入。
- 修正：移除該開啟限制，讓同源地圖分頁沿用執行師登入 session；玩家不同分頁的帳號隔離設定不變。
- 驗證：`npm run typecheck`、`npm run build`、`git diff --check` 通過；建置僅有既有 Tailwind／chunk size 警告。
- 尚待：使用實際執行師帳號按「開啟地圖」完成新分頁登入延續與地圖同步回歸。

## 2026-08-27 幸福歷程失敗結果顯示修正

- 家庭歷程同步參與者擲骰未達門檻時，移除 2.5 秒自動關閉計時器。
- 失敗結果會保留在參與視窗，並改由玩家按「關閉」後才離開；成功、略過與同步失敗重試流程維持原行為。
- 驗證：`npx vitest run src`（171 passed／20 skipped）、`npm run typecheck`、`npm run build`、`git diff --check` 通過。
- 尚待：以實際多人房驗證失敗結果停留、手動關閉及其他玩家同步不受影響。

## 2026-08-27 版本與系統更新日誌

- 對外版本號更新為 `v2.5`。
- 執行師端系統更新日誌新增房市交易、幸福家庭歷程、兼職工作室升級、維修廠確認與共享卡片同步修正說明。
- 驗證：`npm run typecheck`、`npm run build` 與 `git diff --check` 通過；建置僅有既有 Tailwind／chunk size 警告。
- 本次未 commit、push 或部署；完整 3 玩家＋執行師多人回歸仍待新房驗證。

## 2026-08-27 N058 文案顯示路徑修正

- 根因：大地圖在抽卡玩家私有資料尚未載入時直接使用房間內已保存的舊卡片描述；共享卡片事件則只顯示固定的簡短說明。
- 修正：新聞卡顯示一律依 `cardId` 從卡片 schema hydration；共享卡片事件同步顯示同一份完整文案。N058 現在明確說明先開設兼職工作室，再以該工作室申請創業貸款。
- 驗證：`npx vitest run src/utils/boardCardDisplay.test.ts src/test/cardCompletionCoverage.test.ts` 8/8、`npm run typecheck`、`npm run build`、`git diff --check` 通過。
- 本次未 commit、push 或部署；本地 Vite 服務會透過 HMR 套用修改。

## 2026-08-28 v2.6 系統更新日誌與 production 部署

- 對外版本號更新為 `v2.6`；執行師端新增 v2.6 系統更新日誌，僅記錄目前程式與自動化測試已有依據的改善。
- 本地驗證：`npm run typecheck`、`npx vitest run src`（30 files、179 passed、22 skipped）、Firestore Rules（既有 Emulator，22/22）、`npm run build`、`git diff --check` 通過。
- `npm run test:rules` 因既有 Firestore Emulator 佔用 8080 無法重新啟動；改以 `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx vitest run src/test/roomPermissions.test.ts` 完成驗證，未終止既有程序。
- 已部署至 `happinessflow-online` production：`dpl_7vXSHRbcELHmM1fk2xBpARMGZUQ9`，狀態 `READY`；正式網址 HTTP 200，登入頁 DOM 顯示 `v2.6`，production bundle 已確認包含 `v2.6`。
- 保留工作樹既有未提交修改；未修改 `package.json` 的 `0.0.0`。

## 2026-08-29 醫療理賠按鈕與機運卡修正

- 根因：理賠按鈕只依賴目前仍開啟的棋盤卡片與事件 ID；C036 食物中毒完成付款、卡片關閉後，當前事件消失，因此彈窗判定為沒有可理賠事件。
- C035／C036／C037 完成醫療費財務檢核且有醫療保險時，會以 `pendingMedicalClaims` 保存待理賠事件；理賠按鈕可在之後重新開啟、重整後仍顯示，並以卡片固定理賠金額進入財務檢核。
- 待理賠事件以玩家狀態白名單同步，理賠交易使用 `insurance-claim`、卡片事件 ID 與既有 `appliedBoardFinancialEventIds` 防止重送；成功後移除待理賠事件。遊戲結算後按鈕保持不可申請。
- 移除舊的即時醫療／汽車理賠直接改本地現金路徑。C038 維持汽車移除、幸福值、原車貸與理賠的原子處理；C039／C040 投保時由保險支付維修費，不再出現錯誤汽車理賠分頁；C041／C042／C043 全部投保免付，含未投保房屋時每張卡只收一次固定修繕費。
- 理賠彈窗現在列出所有待申請醫療事件，C036 顯示固定 50,000H，不再以醫療保險張數乘算；財務檢核成功訊息與歷史標籤改為醫療保險理賠。
- 驗證：`npm run typecheck` 通過；source Vitest `31 files、199 passed／23 skipped`；Firestore Rules 直接連線測試 `23/23`；`npm run build` 與 `git diff --check` 通過。建置仍有既有 Tailwind ambiguous class、dynamic import 與 chunk size 警告。
- 本次未修改 Firestore Rules，未新增 Firebase 服務、集合或套件；未執行 reset、clean、commit、push 或部署。真實 3／6 玩家瀏覽器理賠流程仍待新房人工回歸。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次修改檔案：`src/types.ts`、`src/context/GameContext.tsx`、`src/context/GameContext.test.ts`、`src/hooks/useGameLogic.ts`、`src/views/game/GameView.tsx`、`src/components/modals/MedicalClaimModal.tsx`、`src/components/modals/MedicalClaimModal.test.tsx`、`src/utils/boardCardActions.ts`、`src/utils/boardCardActions.test.ts`
- 測試結果：typecheck 通過；Vitest 31 files／199 passed／23 skipped；Firestore Rules 23/23；production build 通過；`git diff --check` 通過
- 目前風險：尚未以實際 3／6 玩家瀏覽器重播 C036 重整、連點、理賠財務檢核與 C038–C043 多玩家情境；本地測試未驗證雲端部署環境。
- 下一個最安全任務：使用隔離新房完成單玩家 C035–C043 理賠回歸，再以 3／6 玩家重播同卡競爭與重整流程；確認後才考慮部署。

## 2026-08-31 v2.9 十一項異常修正與 production 部署

- Firebase Auth 已加入並讀回確認 `2ife.vercel.app`；登入錯誤新增 `auth/unauthorized-domain` 明確訊息。正式站 Google Auth iframe 已以新網域初始化，無新 unauthorized-domain console error。
- 股票 UI、舊交易表單與交易套用入口都拒絕零／非有限價格、非正整數張數及總額不一致交易。
- `BoardFinancialFlow` 新增 `manual-bank`；一般銀行交易完成後不再結案目前卡片。定存／保險選項參照固定，N055 可先進信用貸款再回到共享投資提示。
- 學校視窗返回或關閉後可再次開啟；選擇頁移除外層 `touch-none`，保留原生水平捲動容器。
- 共享卡片沿用 120 秒 presence 門檻供房主排除失聯回覆；幸福歷程改用持久化 movement effects 原子恢復，不跨讀其他玩家私有資料。
- 結束回合新增提交中、防連點、耗時 telemetry 與 10 秒同步提示；既有 command ID 冪等邏輯不變。
- Firestore Rules 已發布至 `happinessflow-online`；Vercel production deployment `dpl_BcUaHXkPbzRE5J8ssrnAW8X6TCRc` READY，alias 為 `https://2ife.vercel.app/`，正式站顯示 v2.9、HTTP 200、console error 0。
- 驗證：source Vitest 32 passed／1 skipped（201 passed、23 skipped）；Firestore Rules 23/23；TypeScript、production build、`git diff --check` 通過。新增針對性測試 31/31 通過。
- 未完成：3 玩家 Playwright 受本地重複 Playwright runner 阻斷，6 玩家腳本與帳號尚不存在；因此未宣稱 3／6 玩家完整瀏覽器競買通過。已修正 E2E 臨時設定的 RTDB Rules 絕對路徑，未保留無效 runner 入口修改。

【交接狀態】
- CODEX_HANDOFF.md 是否已更新：是
- 本次修改檔案：`src/types.ts`、`src/context/RoomContext.tsx`、`src/context/RoomContext.test.ts`、`src/views/game/GameView.tsx`、`src/views/lobby/CoachGameView.tsx`、`src/components/banking/BankingAppModal.tsx`、`src/components/banking/BrokerView.tsx`、`src/components/banking/BrokerView.test.tsx`、`src/components/common/SelectionCarousel.tsx`、`src/components/game/GameActions.tsx`、`src/components/game/GameActions.test.tsx`、`src/components/modals/PromotionModal.tsx`、`src/hooks/useGameLogic.ts`、`src/hooks/useTransactionLogic.ts`、`src/views/auth/AuthView.tsx`、`src/constants/version.ts`、`src/views/lobby/CoachDashboard.tsx`、`scripts/e2e/run.mjs`、`DEBUG_HANDOFF.md`、`CODEX_HANDOFF.md`
- 測試結果：Vitest 201 passed／23 skipped；Rules 23/23；TypeScript、production build、diff check；正式站 HTTP 200、v2.9、console error 0
- 目前風險：3／6 玩家完整瀏覽器競買與登入後手機選擇頁實機滑動尚未閉環；Google 帳號選擇器在 in-app browser 以 Auth iframe 初始化，但未代替使用者完成帳號登入
- 下一個最安全任務：先統一 Playwright runner 依賴，再新增 6 玩家 seed 與同屋／異屋競買案例，使用隔離 emulator 完成 3／6 玩家回歸
