/**
 * @module game/commands
 *
 * Headless Game Core — Commands Layer
 *
 * Command 是「意圖（Intent）」的描述，由 Adapter（RoomContext / GameContext）
 * 封裝後傳遞給 GameCoreEngine。
 *
 * 這一層：
 *   - 只定義 Command 的資料形狀（pure data），不含任何執行邏輯
 *   - 不 import React / Firebase
 *
 * Milestone 0：只定義基本結構與 NO_OP（空指令），後續各 System 遷移時加入對應 Command。
 */

export type { GameCommand, BaseCommand, NoOpCommand } from './GameCommand';
export { CommandType } from './GameCommand';
