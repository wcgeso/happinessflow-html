/**
 * @file GameCommand.ts
 * @module game/commands
 *
 * 遊戲命令型別定義。
 *
 * Command 是 UI → Core 的「意圖封裝」。每個 Command 都是一個純資料物件（plain data object），
 * 包含足夠的資訊讓 GameCoreEngine 計算出下一個狀態。
 *
 * 設計原則：
 * - Commands 只是資料（Data Transfer Objects），不含任何邏輯
 * - 不依賴 React / Firebase
 * - 可被 JSON 序列化（用於 logging / replay）
 *
 * Milestone 0：只定義基本型別框架與 NO_OP 指令，後續各 System 遷移時加入對應 Command type。
 */

/**
 * Command 類型枚舉。
 * 後續各 System 遷移時，在此 enum 中加入新的 Command type。
 *
 * @example
 * // Milestone 1（Dice 遷移後）加入：
 * // ROLL_DICE = 'ROLL_DICE',
 */
export enum CommandType {
  /**
   * 無操作指令。用於測試 Gateway 是否正確運作。
   * 在 Milestone 0，Gateway 只接受此類型（或什麼都不做）。
   */
  NO_OP = 'NO_OP',
}

/**
 * 所有 Command 的共同基底介面。
 */
export interface BaseCommand {
  /** Command 的類型識別符 */
  readonly type: CommandType;
  /** 發出此 Command 的玩家 UID */
  readonly playerUid: string;
  /** Command 產生的時間戳（ms since epoch） */
  readonly timestamp: number;
}

/**
 * 無操作指令。用於初期確認 Gateway 接線是否正確。
 */
export interface NoOpCommand extends BaseCommand {
  readonly type: CommandType.NO_OP;
}

/**
 * 所有 GameCommand 的聯合型別（Discriminated Union）。
 * 後續各 System 遷移時，在此 Union 中加入對應 Command 介面。
 *
 * @example
 * // Milestone 1 後：
 * // export type GameCommand = NoOpCommand | RollDiceCommand;
 */
export type GameCommand = NoOpCommand;
