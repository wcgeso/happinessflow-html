/**
 * @file LegacyGameAdapter.ts
 * @module game/adapters
 *
 * Legacy Game Adapter — GameContext 銜接 Game Core 的適配器空殼。
 *
 * 這個 Adapter 未來將被掛載在 GameContext 內部，
 * 作為 GameContext 呼叫 GameCoreEngine 的唯一橋樑。
 *
 * 職責（未來 Milestone 3+ 啟用後）：
 * - 將 GameContext / useGameLogic / useTransactionLogic 的財務計算邏輯
 *   改為透過 CommandGateway 送入 Core Financial System
 * - 根據 Feature Flag：
 *     - Flag = false → return false（不接管，GameContext 繼續走 Legacy 路徑）
 *     - Flag = true  → 執行 Core 邏輯，寫回 Firestore，return true
 *
 * Milestone 0：
 * - 所有方法回傳 false（不接管任何行為）
 * - GameContext 目前不需要引用此 Adapter
 *
 * 設計注意事項：
 * - 此 Adapter 可以 import Firebase（用於 Firestore 寫回）
 * - 此 Adapter 不應包含任何遊戲商業規則本身
 */

import { CommandGateway } from '../core/CommandGateway';
import { globalGameCoreEngine } from '../core/GameCoreEngine';

/**
 * Legacy Game Adapter 空殼。
 *
 * 由 GameContext 實例化（或由 hook 提供）。
 * 在 Milestone 0，所有方法直接回傳 false，表示「未接管，繼續走 Legacy」。
 */
export class LegacyGameAdapter {
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
   * 嘗試透過 Core 執行財務交易（購買資產、還款、領薪等）。
   * @returns false — Milestone 0 不接管，GameContext 繼續走 Legacy 路徑
   * @future Milestone 3：當 coreFeatureFlags.useCoreFinancial 為 true 時啟用
   */
  tryDispatchFinancialAction(_actionType: string): boolean {
    return false;
  }
}

/**
 * 全域共用的 LegacyGameAdapter 實例（Singleton）。
 *
 * Milestone 0：此實例只是「就位等候」，不接管任何行為。
 */
export const globalLegacyGameAdapter = new LegacyGameAdapter(
  new CommandGateway(globalGameCoreEngine)
);
