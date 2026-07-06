/**
 * @file featureFlags.ts
 * @module game/core
 *
 * 系統層級 Feature Flags（System-Level Feature Flags）
 *
 * 每個 Flag 控制是否啟用對應的 Game Core System，取代舊的 Legacy 實作。
 * 在 Milestone 0，所有 Flag 必須保持 false（不接管任何行為）。
 *
 * 啟用方式（未來 Milestone 1+ 使用）：
 * - 將對應 Flag 設為 true，Adapter 將在接受到相關 Command 時呼叫 Core 取代 Legacy
 *
 * ⚠️ 安全規則：
 * - 任何 Flag 設為 true 前，必須先完成對應 System 的 Characterization Test 與 Spec Test
 * - 任何 Flag 設為 true 後，若發現 bug，只需將其重設為 false 即可立即回退至 Legacy
 */

export interface CoreFeatureFlags {
  /** Milestone 1：使用 Core 的 Dice System（隨機骰點）*/
  readonly useCoreDice: boolean;
  /** Milestone 1：使用 Core 的 Movement System（棋盤移動與路徑計算）*/
  readonly useCoreMovement: boolean;
  /** Milestone 1：使用 Core 的 Turn System（回合順序與輪空跳過）*/
  readonly useCoreTurn: boolean;
  /** Milestone 2：使用 Core 的 Event Queue System（棋盤事件佇列管理）*/
  readonly useCoreEventQueue: boolean;
  /** Milestone 3：使用 Core 的 Financial System（財務計算、Payday 月結餘）*/
  readonly useCoreFinancial: boolean;
  /** Milestone 4：使用 Core 的 Card System（卡片抽取與效果 Resolver）*/
  readonly useCoreCard: boolean;
}

/**
 * 目前生效的 Feature Flags。
 *
 * ⚠️ Milestone 0：所有 Flag 必須為 false。
 * 修改此物件前，必須確認對應 System 的測試全部通過。
 */
export const coreFeatureFlags: Readonly<CoreFeatureFlags> = Object.freeze({
  useCoreDice: false,
  useCoreMovement: false,
  useCoreTurn: false,
  useCoreEventQueue: false,
  useCoreFinancial: false,
  useCoreCard: false,
} satisfies CoreFeatureFlags);
