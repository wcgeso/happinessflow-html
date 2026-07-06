/**
 * @file StateTransitionResult.ts
 * @module game/events
 *
 * State Transition Result 型別定義。
 *
 * 這是 Core 執行完 Command 後回傳給 Adapter 的結果結構。
 * Adapter 根據此結果決定要如何更新 Firestore 或 React State。
 *
 * 設計原則：
 * - 純資料（plain data），不含邏輯
 * - 不依賴 React / Firebase
 * - 可被 JSON 序列化
 *
 * Milestone 0：只定義基本結構與 NO_OP 事件，後續各 System 遷移時加入對應 event。
 */

import type { CoreGameState } from '../state/CoreGameState';

/**
 * Transition Event 類型枚舉。
 * 後續各 System 遷移時，在此 enum 中加入新的 event type。
 */
export enum TransitionEventType {
  /** 無操作事件。對應 NO_OP Command。 */
  NO_OP = 'NO_OP',
}

/**
 * 所有 Transition Event 的共同基底介面。
 */
export interface BaseTransitionEvent {
  readonly type: TransitionEventType;
}

/**
 * 無操作事件。對應 NO_OP Command 的結果。
 */
export interface NoOpTransitionEvent extends BaseTransitionEvent {
  readonly type: TransitionEventType.NO_OP;
}

/**
 * 所有可能發生的 Transition Event 的聯合型別（Discriminated Union）。
 * 後續各 System 遷移時，在此 Union 中加入對應 Event 介面。
 */
export type TransitionEvent = NoOpTransitionEvent;

/**
 * Core 執行 Command 後回傳的完整結果結構。
 *
 * @property nextState - Core 計算出的新狀態快照
 * @property events    - 此次 transition 中發生的所有事件列表（供 Adapter 同步 Firestore 使用）
 * @property error     - 若 Command 執行失敗，此欄位包含錯誤描述
 */
export interface StateTransitionResult {
  readonly nextState: CoreGameState;
  readonly events: TransitionEvent[];
  readonly error?: string;
}
