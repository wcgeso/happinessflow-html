/**
 * @module game/events
 *
 * Headless Game Core — Events Layer
 *
 * Event 是 Core 執行 Command 後，回傳給 Adapter 的「狀態變更描述」。
 * Adapter 接收 Event 後，負責將變更寫回 Firestore（或更新 React State）。
 *
 * 這一層：
 *   - 只定義 Event 的資料形狀（pure data），不含任何執行邏輯
 *   - 不 import React / Firebase
 *
 * Milestone 0：只定義基本結構，後續各 System 遷移時加入對應 Event。
 */

export type { StateTransitionResult, BaseTransitionEvent, NoOpTransitionEvent } from './StateTransitionResult';
export { TransitionEventType } from './StateTransitionResult';
