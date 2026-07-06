/**
 * @file CommandGateway.ts
 * @module game/core
 *
 * Command Gateway — Adapter 與 Core 之間的中介橋樑。
 *
 * 職責：
 * - 提供統一的 dispatch 介面給 Adapter（RoomContext / GameContext）呼叫
 * - 根據 Feature Flags 判斷：
 *     - 若對應 System 的 Flag 為 false → 忽略此 Command（Legacy 繼續執行）
 *     - 若對應 System 的 Flag 為 true  → 將 Command 傳入 GameCoreEngine 執行
 * - 將 Engine 回傳的 StateTransitionResult 傳遞給呼叫者（Adapter）
 *
 * 不包含：
 * - React 相依
 * - Firebase 相依
 * - 任何商業規則邏輯
 *
 * Milestone 0：
 * - 所有 Feature Flags 為 false，Gateway 接受所有 Command 但什麼都不做
 * - dispatch() 直接回傳 null，告知 Adapter「繼續走 Legacy 路徑」
 */

import type { GameCommand } from '../commands/GameCommand';
import type { StateTransitionResult } from '../events/StateTransitionResult';
import type { GameCoreEngine } from './GameCoreEngine';
import { coreFeatureFlags } from './featureFlags';

/**
 * Adapter 可以偵測 Gateway dispatch 結果的三種情境：
 * - null         → Flag 為 false，Adapter 應繼續使用 Legacy 邏輯
 * - Result (ok)  → Core 執行成功，Adapter 應根據 events 更新 Firestore
 * - Result (err) → Core 執行失敗，Adapter 可選擇 fallback 至 Legacy 或顯示錯誤
 */
export type GatewayDispatchResult = StateTransitionResult | null;

/**
 * Command Gateway。
 *
 * 由 Adapter（如 RoomContext、GameContext）實例化並持有，
 * 每次使用者觸發操作時，Adapter 可呼叫 gateway.dispatch(command)
 * 確認是否需要改由 Core 處理。
 *
 * Milestone 0：所有 dispatch 回傳 null（Legacy 繼續執行）。
 */
export class CommandGateway {
  private readonly engine: GameCoreEngine;

  constructor(engine: GameCoreEngine) {
    this.engine = engine;
  }

  /**
   * 分發一個 Command 至 Core Engine。
   *
   * @returns `null`  — Feature Flag 為 false，呼叫者應繼續走 Legacy 路徑（Milestone 0 的唯一結果）
   * @returns `StateTransitionResult` — Flag 為 true，Core 執行完成，呼叫者應根據 events 更新狀態
   *
   * Milestone 0：由於所有 Flag 為 false，此方法永遠回傳 null。
   */
  dispatch(command: GameCommand): GatewayDispatchResult {
    // Milestone 0：所有 system flags 皆為 false，直接回傳 null
    // 未來 Milestone 1+ 開始，在此依照 command.type 與對應 flag 決定是否分流
    const _ = coreFeatureFlags; // 確保此 import 在未來被使用時不報 lint 錯誤

    // 目前不分流任何指令至 Core，全部讓 Legacy 繼續執行
    void command; // 告知 TypeScript 此參數刻意未使用（Milestone 0 期間）

    return null;
  }
}
