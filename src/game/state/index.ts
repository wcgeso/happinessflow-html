/**
 * @module game/state
 *
 * Headless Game Core — State Layer
 *
 * 這裡定義純粹的 TypeScript 介面與型別，代表 Game Core 的狀態結構。
 * 這一層：
 *   - 不 import 任何 React
 *   - 不 import 任何 Firebase
 *   - 不包含任何副作用（side effect）
 *   - 只是資料的形狀定義（Data Shape Definitions）
 *
 * Milestone 0：空殼定義，後續各 System 遷移時在此擴充。
 */

export type { CoreGameState } from './CoreGameState';
