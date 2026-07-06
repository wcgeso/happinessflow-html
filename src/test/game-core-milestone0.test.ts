/**
 * @file game-core-milestone0.test.ts
 *
 * Milestone 0 Smoke Test
 *
 * 目的：驗證 Game Core 空殼正確初始化，且所有 Feature Flags 為 false，
 * 確保任何 Command 都不會被 Core 接管（Gateway 永遠回傳 null）。
 *
 * 這組測試必須在每次合併前通過，以確保 Milestone 0 的完成條件成立。
 */

import { describe, it, expect } from 'vitest';
import {
  coreFeatureFlags,
  globalGameCoreEngine,
  CommandGateway,
  GameCoreEngine,
  CommandType,
  TransitionEventType,
  createEmptyCoreGameState,
  globalLegacyRoomAdapter,
  globalLegacyGameAdapter,
} from '../game';

describe('Milestone 0: Core 空殼與 Feature Flags', () => {
  describe('Feature Flags', () => {
    it('所有 Feature Flags 必須預設為 false', () => {
      expect(coreFeatureFlags.useCoreDice).toBe(false);
      expect(coreFeatureFlags.useCoreMovement).toBe(false);
      expect(coreFeatureFlags.useCoreTurn).toBe(false);
      expect(coreFeatureFlags.useCoreEventQueue).toBe(false);
      expect(coreFeatureFlags.useCoreFinancial).toBe(false);
      expect(coreFeatureFlags.useCoreCard).toBe(false);
    });

    it('Feature Flags 物件為凍結狀態（不可修改）', () => {
      expect(Object.isFrozen(coreFeatureFlags)).toBe(true);
    });
  });

  describe('GameCoreEngine', () => {
    it('可以建立 Engine 實例', () => {
      const engine = new GameCoreEngine();
      expect(engine).toBeDefined();
    });

    it('初始狀態的 _version 為 0', () => {
      const engine = new GameCoreEngine();
      expect(engine.getState()._version).toBe(0);
    });

    it('dispatch NO_OP 不改變狀態', () => {
      const engine = new GameCoreEngine();
      const before = engine.getState();
      const result = engine.dispatch({
        type: CommandType.NO_OP,
        playerUid: 'test-uid',
        timestamp: Date.now(),
      });
      expect(result.error).toBeUndefined();
      expect(result.nextState).toStrictEqual(before);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(TransitionEventType.NO_OP);
    });

    it('全域 Engine 實例已初始化', () => {
      expect(globalGameCoreEngine).toBeDefined();
      expect(globalGameCoreEngine.getState()._version).toBe(0);
    });
  });

  describe('CommandGateway', () => {
    it('所有 Command 在 Milestone 0 回傳 null（不接管）', () => {
      const engine = new GameCoreEngine();
      const gateway = new CommandGateway(engine);

      const result = gateway.dispatch({
        type: CommandType.NO_OP,
        playerUid: 'test-uid',
        timestamp: Date.now(),
      });

      expect(result).toBeNull();
    });
  });

  describe('CoreGameState', () => {
    it('createEmptyCoreGameState 回傳正確的空狀態', () => {
      const state = createEmptyCoreGameState();
      expect(state._version).toBe(0);
    });
  });

  describe('LegacyRoomAdapter', () => {
    it('全域 Adapter 實例已初始化且 isReady()', () => {
      expect(globalLegacyRoomAdapter.isReady()).toBe(true);
    });

    it('tryRollBoardDice 回傳 false（不接管）', () => {
      expect(globalLegacyRoomAdapter.tryRollBoardDice('test-uid')).toBe(false);
    });

    it('tryAdvanceBoardEventQueue 回傳 false（不接管）', () => {
      expect(globalLegacyRoomAdapter.tryAdvanceBoardEventQueue()).toBe(false);
    });
  });

  describe('LegacyGameAdapter', () => {
    it('全域 Adapter 實例已初始化且 isReady()', () => {
      expect(globalLegacyGameAdapter.isReady()).toBe(true);
    });

    it('tryDispatchFinancialAction 回傳 false（不接管）', () => {
      expect(globalLegacyGameAdapter.tryDispatchFinancialAction('some_action')).toBe(false);
    });
  });
});
