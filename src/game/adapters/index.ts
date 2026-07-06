/**
 * @module game/adapters
 *
 * Headless Game Core — Adapters Layer
 *
 * Adapter 是 React Context（Legacy UI 層）與 Headless Game Core 之間的橋樑。
 *
 * 職責：
 * - 將 UI 觸發的行為（例如 rollDice、payBank）封裝為 GameCommand 並送入 CommandGateway
 * - 根據 CommandGateway 回傳的 StateTransitionResult，將變更寫回 Firestore
 * - 若 CommandGateway 回傳 null（Feature Flag 為 false），Adapter 繼續使用 Legacy 邏輯
 *
 * 這一層：
 *   - 可以 import React（作為 hook 的宿主）
 *   - 可以 import Firebase（用於 Firestore 同步）
 *   - 不應包含任何遊戲商業規則
 *
 * Milestone 0：只有空殼 Adapter，不接管任何行為。
 */

export { LegacyRoomAdapter } from './LegacyRoomAdapter';
export { LegacyGameAdapter } from './LegacyGameAdapter';
