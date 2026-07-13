# HappinessFlow P0 Integration Handoff

## Current branch

- Branch: `修復環境260713`
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
