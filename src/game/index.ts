/**
 * @module game
 *
 * Headless Game Core — 頂層公開 API
 *
 * 這是整個 src/game/ 目錄的對外公開 barrel。
 * 外部程式碼（如 React Context）只應從此處 import，
 * 不應直接 import 內部子模組路徑（如 src/game/core/GameCoreEngine.ts）。
 *
 * Milestone 0：
 * - 只暴露 Feature Flags（供 Adapter 查詢）
 * - 只暴露 Adapter 實例（供 Context 接線用，但 Milestone 0 下不接管任何行為）
 * - 暴露 Engine 實例（供未來測試使用）
 */

// Feature Flags
export { coreFeatureFlags } from './core/featureFlags';
export type { CoreFeatureFlags } from './core/featureFlags';

// Core Engine（主要供測試與未來使用）
export { globalGameCoreEngine, GameCoreEngine } from './core/GameCoreEngine';
export type { GameCoreEngineConfig } from './core/GameCoreEngine';

// Command Gateway
export { CommandGateway } from './core/CommandGateway';
export type { GatewayDispatchResult } from './core/CommandGateway';

// Adapters（供 RoomContext / GameContext 接線用）
export { globalLegacyRoomAdapter, LegacyRoomAdapter } from './adapters/LegacyRoomAdapter';
export { globalLegacyGameAdapter, LegacyGameAdapter } from './adapters/LegacyGameAdapter';

// State Types（供未來測試與 Adapter 使用）
export type { CoreGameState } from './state/CoreGameState';
export { createEmptyCoreGameState } from './state/CoreGameState';

// Command Types
export type { GameCommand } from './commands/GameCommand';
export { CommandType } from './commands/GameCommand';

// Event / Result Types
export type { StateTransitionResult } from './events/StateTransitionResult';
export { TransitionEventType } from './events/StateTransitionResult';
