# 第二人生 P0 Integration Handoff

## Current branch

- Branch: `本地開發環境260714`
- Worktree: `.claude/worktrees/260712`
- Original worktrees were left untouched.

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
