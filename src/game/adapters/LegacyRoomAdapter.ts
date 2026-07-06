/**
 * @file LegacyRoomAdapter.ts
 * @module game/adapters
 *
 * Legacy Room Adapter — RoomContext 銜接 Game Core 的適配器空殼。
 *
 * 這個 Adapter 未來將被掛載在 RoomContext 內部，
 * 作為 RoomContext 呼叫 GameCoreEngine 的唯一橋樑。
 *
 * 職責（未來 Milestone 1+ 啟用後）：
 * - 將 RoomContext 現有方法（如 rollBoardDice）的邏輯改為透過 CommandGateway 送入 Core
 * - 根據 Feature Flag：
 *     - Flag = false → return false（不接管，RoomContext 繼續走 Legacy 路徑）
 *     - Flag = true  → 執行 Core 邏輯，寫回 Firestore，return true（表示已由 Core 處理）
 *
 * Milestone 0：
 * - 所有方法回傳 false（不接管任何行為）
 * - RoomContext 目前不需要引用此 Adapter，
 *   這裡只是「架構就位」，確認未來接線方式正確
 *
 * 設計注意事項：
 * - 此 Adapter 可以 import Firebase（用於 Firestore 寫回）
 * - 此 Adapter 不應包含任何遊戲商業規則本身
 */

import { CommandGateway } from '../core/CommandGateway';
import { globalGameCoreEngine } from '../core/GameCoreEngine';

/**
 * Legacy Room Adapter 空殼。
 *
 * 由 RoomContext 實例化（或由 hook 提供）。
 * 在 Milestone 0，所有方法直接回傳 false，表示「未接管，繼續走 Legacy」。
 *
 * 未來各 Milestone 中，依照 Feature Flag 逐步啟用各個方法的 Core 實作。
 */
export class LegacyRoomAdapter {
  private readonly gateway: CommandGateway;

  constructor(gateway: CommandGateway) {
    this.gateway = gateway;
  }

  /**
   * 確認 Adapter 是否已正確初始化（用於 Milestone 0 的 smoke test）。
   */
  isReady(): boolean {
    return this.gateway !== undefined;
  }

  // ─── 以下為未來 Milestone 中逐步啟用的方法（Milestone 0：全部回傳 false）───

  /**
   * 嘗試透過 Core 執行擲骰。
   * @returns false — Milestone 0 不接管，RoomContext 繼續走 Legacy 路徑
   * @future Milestone 1：當 coreFeatureFlags.useCoreDice 為 true 時，回傳 true 並執行 Core 邏輯
   */
  tryRollBoardDice(_playerUid: string): boolean {
    // Milestone 0：Flag 為 false，不接管
    return false;
  }

  /**
   * 嘗試透過 Core 推進事件佇列。
   * @returns false — Milestone 0 不接管
   */
  tryAdvanceBoardEventQueue(): boolean {
    return false;
  }
}

/**
 * 全域共用的 LegacyRoomAdapter 實例（Singleton）。
 *
 * Milestone 0：此實例只是「就位等候」，
 * RoomContext 目前不需要主動呼叫它，因為所有方法都回傳 false。
 */
export const globalLegacyRoomAdapter = new LegacyRoomAdapter(
  new CommandGateway(globalGameCoreEngine)
);
