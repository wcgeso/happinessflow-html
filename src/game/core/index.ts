/**
 * @module game/core
 *
 * Headless Game Core — Core Engine Layer
 *
 * 核心引擎（GameCoreEngine）是整個 Core 的頂層協調者。
 * 它接收 Command，根據當前 CoreGameState 呼叫對應的 System 計算出新狀態，
 * 並回傳 StateTransitionResult 給 Adapter。
 *
 * 這一層：
 *   - 不 import React / Firebase
 *   - 只協調 Systems，不包含任何商業規則本身
 *
 * Milestone 0：只有空殼 Engine。
 */

export { GameCoreEngine } from './GameCoreEngine';
export type { GameCoreEngineConfig } from './GameCoreEngine';
export { CommandGateway } from './CommandGateway';
