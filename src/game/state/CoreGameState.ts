/**
 * @file CoreGameState.ts
 * @module game/state
 *
 * 核心遊戲狀態的頂層容器介面。
 *
 * Milestone 0：空殼結構，僅佔位，後續各 System 遷移時填入對應欄位。
 * 每個 System 遷移完成後，對應的 sub-state 介面將被加入此容器。
 *
 * 設計原則：
 * - 不依賴 Firebase / Firestore 型別
 * - 不依賴 React
 * - 可被序列化為 JSON（pure data）
 */

/**
 * 核心遊戲狀態容器。
 * 目前為空殼，後續各 System 遷移時在此加入欄位。
 *
 * @example
 * // 未來加入 Dice 系統後，會像這樣：
 * // diceState: DiceState;
 * //
 * // 未來加入 Turn 系統後，會像這樣：
 * // turnState: TurnState;
 */
export interface CoreGameState {
  /**
   * 狀態版本號，用於後向相容性追蹤。
   * 在 Milestone 0，沒有任何系統遷移，固定為 0。
   */
  readonly _version: 0;
}

/**
 * 空的初始核心遊戲狀態工廠，
 * 在 Milestone 0 只回傳帶有 _version 的空殼。
 */
export function createEmptyCoreGameState(): CoreGameState {
  return { _version: 0 };
}
