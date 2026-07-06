/**
 * @module game/systems
 *
 * Headless Game Core — Systems Layer
 *
 * 每個 System 是一個純函數模組，負責特定領域的規則計算。
 * System 的輸入是當前狀態與 Command，輸出是新狀態片段與事件。
 *
 * 這一層：
 *   - 只包含純函數（pure functions），不含副作用
 *   - 不 import React / Firebase
 *   - 可被單獨測試（Characterization Test / Spec Test）
 *
 * Milestone 0：空殼，後續各 System 遷移時在此加入對應 System 模組的 export。
 *
 * 預計加入的 Systems（按遷移順序）：
 *   - Dice
 *   - Board
 *   - Movement
 *   - TurnTracker
 *   - EventQueue
 *   - Financial
 *   - Asset
 *   - Liability
 *   - Insurance
 *   - StockMarket
 *   - Happiness
 *   - FamilyMilestone
 *   - CardSystem
 *   - SharedEvent
 *   - Profession
 *   - RealEstateBusiness
 *   - Settlement
 */

// Milestone 0：無 System 匯出。後續各 System 遷移時在此加入。
// export * from './Dice';
// export * from './Board';
// export * from './Movement';
// ... etc.
