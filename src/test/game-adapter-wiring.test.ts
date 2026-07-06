/**
 * @file game-adapter-wiring.test.ts
 *
 * Milestone 0.5 — Adapter Wiring Tests
 *
 * 目的：驗證 Adapter 已正確接線至 CommandGateway → GameCoreEngine，
 * 且在所有 Feature Flags 為 false 的情況下，
 * 任何操作都不會改變遊戲行為（Gateway 永遠回傳 null）。
 *
 * 架構驗證重點：
 * 1. LegacyRoomAdapter 可與 CommandGateway 正確初始化
 * 2. LegacyGameAdapter 可與 CommandGateway 正確初始化
 * 3. 同一個 globalGameCoreEngine 可被多個 Adapter 共用
 * 4. 任何 Command dispatch 在 flags=false 時都不產生狀態變更
 * 5. 連鎖路徑：RoomAdapter → Gateway → Engine 完整可達
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  globalGameCoreEngine,
  GameCoreEngine,
  CommandGateway,
  LegacyRoomAdapter,
  LegacyGameAdapter,
  coreFeatureFlags,
  CommandType,
  createEmptyCoreGameState,
} from '../game';

// ─── Fixture helpers ───────────────────────────────────────────────────────

function makeGateway(engine?: GameCoreEngine): CommandGateway {
  return new CommandGateway(engine ?? new GameCoreEngine());
}

function makeRoomAdapter(gateway?: CommandGateway): LegacyRoomAdapter {
  return new LegacyRoomAdapter(gateway ?? makeGateway());
}

function makeGameAdapter(gateway?: CommandGateway): LegacyGameAdapter {
  return new LegacyGameAdapter(gateway ?? makeGateway());
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('Milestone 0.5: Adapter Wiring', () => {
  describe('共同前置條件', () => {
    it('所有 Feature Flags 維持 false（Milestone 0.5 不啟用任何 System）', () => {
      expect(coreFeatureFlags.useCoreDice).toBe(false);
      expect(coreFeatureFlags.useCoreMovement).toBe(false);
      expect(coreFeatureFlags.useCoreTurn).toBe(false);
      expect(coreFeatureFlags.useCoreEventQueue).toBe(false);
      expect(coreFeatureFlags.useCoreFinancial).toBe(false);
      expect(coreFeatureFlags.useCoreCard).toBe(false);
    });
  });

  describe('LegacyRoomAdapter 接線', () => {
    let engine: GameCoreEngine;
    let gateway: CommandGateway;
    let adapter: LegacyRoomAdapter;

    beforeEach(() => {
      engine = new GameCoreEngine();
      gateway = makeGateway(engine);
      adapter = makeRoomAdapter(gateway);
    });

    it('可以成功建立並通過 isReady()', () => {
      expect(adapter.isReady()).toBe(true);
    });

    it('tryRollBoardDice 回傳 false（不接管）', () => {
      const result = adapter.tryRollBoardDice('player-001');
      expect(result).toBe(false);
    });

    it('tryAdvanceBoardEventQueue 回傳 false（不接管）', () => {
      const result = adapter.tryAdvanceBoardEventQueue();
      expect(result).toBe(false);
    });

    it('呼叫 tryRollBoardDice 後，Engine 狀態不改變', () => {
      const stateBefore = engine.getState();
      adapter.tryRollBoardDice('player-001');
      const stateAfter = engine.getState();
      expect(stateAfter).toStrictEqual(stateBefore);
    });

    it('呼叫 tryAdvanceBoardEventQueue 後，Engine 狀態不改變', () => {
      const stateBefore = engine.getState();
      adapter.tryAdvanceBoardEventQueue();
      const stateAfter = engine.getState();
      expect(stateAfter).toStrictEqual(stateBefore);
    });
  });

  describe('LegacyGameAdapter 接線', () => {
    let engine: GameCoreEngine;
    let gateway: CommandGateway;
    let adapter: LegacyGameAdapter;

    beforeEach(() => {
      engine = new GameCoreEngine();
      gateway = makeGateway(engine);
      adapter = makeGameAdapter(gateway);
    });

    it('可以成功建立並通過 isReady()', () => {
      expect(adapter.isReady()).toBe(true);
    });

    it('tryDispatchFinancialAction 回傳 false（不接管）', () => {
      const result = adapter.tryDispatchFinancialAction('buy_asset');
      expect(result).toBe(false);
    });

    it('呼叫 tryDispatchFinancialAction 後，Engine 狀態不改變', () => {
      const stateBefore = engine.getState();
      adapter.tryDispatchFinancialAction('buy_asset');
      const stateAfter = engine.getState();
      expect(stateAfter).toStrictEqual(stateBefore);
    });
  });

  describe('CommandGateway 端對端接線', () => {
    it('Gateway dispatch NO_OP 在 flags=false 時回傳 null', () => {
      const gateway = makeGateway();
      const result = gateway.dispatch({
        type: CommandType.NO_OP,
        playerUid: 'test-uid',
        timestamp: Date.now(),
      });
      expect(result).toBeNull();
    });

    it('多個 Adapter 共用同一個 Engine，不互相干擾', () => {
      const engine = new GameCoreEngine();
      const gateway = makeGateway(engine);
      const roomAdapter = makeRoomAdapter(gateway);
      const gameAdapter = makeGameAdapter(makeGateway(engine)); // 獨立 gateway，共用 engine

      expect(roomAdapter.isReady()).toBe(true);
      expect(gameAdapter.isReady()).toBe(true);

      // 兩個 adapter 都呼叫後，engine 狀態仍保持不變
      roomAdapter.tryRollBoardDice('p1');
      gameAdapter.tryDispatchFinancialAction('buy_asset');
      expect(engine.getState()).toStrictEqual(createEmptyCoreGameState());
    });
  });

  describe('全域 Singleton 接線（globalGameCoreEngine）', () => {
    it('全域 Engine 狀態在多個 Adapter 操作後仍保持 _version: 0', () => {
      // 建立新的 Adapter 接到全域 Engine
      const roomAdapter = new LegacyRoomAdapter(new CommandGateway(globalGameCoreEngine));
      const gameAdapter = new LegacyGameAdapter(new CommandGateway(globalGameCoreEngine));

      roomAdapter.tryRollBoardDice('p1');
      gameAdapter.tryDispatchFinancialAction('sell_asset');

      // 全域 Engine 狀態未被修改
      expect(globalGameCoreEngine.getState()._version).toBe(0);
    });
  });
});
