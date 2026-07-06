/**
 * @file GameCoreEngine.ts
 * @module game/core
 *
 * 核心遊戲引擎（Headless Game Core Engine）。
 *
 * 職責：
 * - 接收 GameCommand（由 Adapter / CommandGateway 傳入）
 * - 根據當前 CoreGameState 呼叫對應的 System 計算新狀態
 * - 回傳 StateTransitionResult（供 Adapter 同步至 Firestore / React State）
 *
 * 不包含：
 * - React 相依
 * - Firebase 相依
 * - 任何 I/O 或副作用
 *
 * Milestone 0：空殼實作。
 * - 只接受 NO_OP Command
 * - 不改變任何狀態
 * - 不產生任何實質 event
 */

import type { GameCommand } from '../commands/GameCommand';
import { CommandType } from '../commands/GameCommand';
import type { CoreGameState } from '../state/CoreGameState';
import { createEmptyCoreGameState } from '../state/CoreGameState';
import type { StateTransitionResult } from '../events/StateTransitionResult';
import { TransitionEventType } from '../events/StateTransitionResult';
import { coreFeatureFlags } from './featureFlags';

export interface GameCoreEngineConfig {
  /** 啟用 debug logging（僅開發環境使用） */
  readonly debug?: boolean;
}

/**
 * Headless Game Core Engine。
 *
 * Milestone 0：此 Engine 不執行任何遊戲邏輯，
 * 僅作為未來 System 遷移的載體（container）存在。
 * 所有 Feature Flags 預設為 false，Engine 不接管任何行為。
 */
export class GameCoreEngine {
  private state: CoreGameState;
  private readonly config: GameCoreEngineConfig;

  constructor(config: GameCoreEngineConfig = {}) {
    this.config = config;
    this.state = createEmptyCoreGameState();
  }

  /**
   * 取得目前 Core 的狀態快照（唯讀）。
   */
  getState(): Readonly<CoreGameState> {
    return this.state;
  }

  /**
   * 處理一個 GameCommand，計算新狀態並回傳 StateTransitionResult。
   *
   * Milestone 0：只處理 NO_OP Command，其餘 Command 類型尚未支援。
   * 當 feature flags 全部為 false 時，任何非 NO_OP 的指令都不應被送入此處，
   * 因為 Adapter 在 flag 為 false 時應直接走 Legacy 路徑，不會呼叫此 Engine。
   */
  dispatch(command: GameCommand): StateTransitionResult {
    if (this.config.debug) {
      console.debug('[GameCoreEngine] dispatch:', command.type);
    }

    switch (command.type) {
      case CommandType.NO_OP:
        return this.handleNoOp();

      default: {
        // 窮舉型別保護（exhaustiveness check）
        // 未來加入新 Command type 時，若忘記處理，TypeScript 會在此報錯。
        // GameCommand 目前只有 NO_OP，此分支在執行時不可觸及，但保留作安全防護。
        return assertNeverCommand(command as never, this.state);
      }
    }
  }

  private handleNoOp(): StateTransitionResult {
    // NO_OP：不更改狀態，回傳空事件列表
    return {
      nextState: this.state,
      events: [{ type: TransitionEventType.NO_OP }],
    };
  }
}

/**
 * Exhaustiveness check helper。
 * TypeScript 要求所有可能的 Command type 都被處理，
 * 此函式確保 default branch 在 type 窮舉時會報 compile error。
 * 同時在 runtime 也提供安全的 fallback。
 */
function assertNeverCommand(command: never, currentState: CoreGameState): StateTransitionResult {
  const unknownCommand = command as GameCommand;
  console.warn('[GameCoreEngine] Unknown command type:', unknownCommand.type);
  return {
    nextState: currentState,
    events: [],
    error: `Unknown command type: ${unknownCommand.type}`,
  };
}

/**
 * 全域共用的 Engine 實例（Singleton）。
 *
 * Milestone 0：在所有 Feature Flags 為 false 的情況下，
 * Adapter 不會將任何指令送入此 Engine，因此此實例只是「就位等候」，
 * 不會對任何遊戲流程產生影響。
 *
 * 未來 Feature Flags 逐步啟用後，Adapter 才會開始使用此 Engine。
 */
export const globalGameCoreEngine = new GameCoreEngine({
  debug: import.meta.env.DEV,
});

// 確認目前 Feature Flags 狀態（僅在開發環境輸出）
if (import.meta.env.DEV) {
  console.debug('[GameCoreEngine] Feature flags (all should be false in Milestone 0):', coreFeatureFlags);
}
