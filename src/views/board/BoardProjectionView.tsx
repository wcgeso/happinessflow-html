import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, GraduationCap, Heart, HeartCrack, Landmark, Newspaper, ScrollText, Sparkles, TrendingDown, TrendingUp, Wrench } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import SafeImage from '../../components/common/SafeImage';
import { BoardCardLogPanel } from '../../components/board/BoardCardLogPanel';
import { STOCK_NAMES } from '../../constants';
import { BOARD_SQUARES } from '../../constants/board';
import { NEWS_CARD_MAP, normalizeCardCopy } from '../../constants/cards';
import { Room } from '../../context/RoomContext';
import { BoardCardLogEntry, BoardCardResult, BoardSquare, SkippedTurnNotice } from '../../types';
import { getCardNarrative, hydrateBoardCardResult } from '../../utils/boardCardDisplay';
import { FAMILY_MILESTONE_STAGES } from '../../utils/familyMilestones';
import { SettlementView } from '../../components/game/SettlementView';
import { buildSettlementPlayers } from '../../utils/settlement';
import { toCardPresentationModel } from '../../utils/cardPresentation';

const TILE_SIZE = 126;
const TILE_GAP = 16;
const BOARD_PADDING = 84;
const BOARD_GRID_SIZE = TILE_SIZE * 14 + TILE_GAP * 13;
const BOARD_WIDTH = BOARD_GRID_SIZE + BOARD_PADDING * 2;
const BOARD_HEIGHT = BOARD_GRID_SIZE + BOARD_PADDING * 2;
const FIT_ZOOM_FALLBACK = 0.62;
const VIEWPORT_PADDING_X = 64;
const VIEWPORT_PADDING_TOP = 80;
const VIEWPORT_PADDING_BOTTOM = 32;
const BOARD_MOVEMENT_TICK_MS = 80;
const SKIPPED_TURN_NOTICE_MS = 2600;

const SQUARE_THEME: Record<BoardSquare['type'], {
  bg: string;
  border: string;
  surface: string;
  bevel: string;
  glow: string;
  icon: string;
  text: string;
  cardBack: string;
  label: string;
}> = {
  school: {
    bg: 'bg-[#d8c4a8]',
    border: 'border-[#9d7a54]',
    surface: 'from-[#ead9c3] via-[#d9c1a0] to-[#c8a57a]',
    bevel: 'from-white/70 via-white/15 to-[#8f6a42]/18',
    glow: 'shadow-[inset_0_1px_0_rgba(255,250,240,0.85),0_18px_30px_-18px_rgba(126,92,55,0.8)]',
    icon: 'text-[#7a5b36]',
    text: 'text-[#563c24]',
    cardBack: 'from-[#d8c4a8] via-[#c9ad86] to-[#b99367]',
    label: '學校'
  },
  hospital: {
    bg: 'bg-[#e7c8bc]',
    border: 'border-[#b7775d]',
    surface: 'from-[#f0ddd4] via-[#e5bfb0] to-[#d59b84]',
    bevel: 'from-white/70 via-white/18 to-[#9f5f49]/20',
    glow: 'shadow-[inset_0_1px_0_rgba(255,248,244,0.88),0_18px_30px_-18px_rgba(154,95,72,0.72)]',
    icon: 'text-[#92563f]',
    text: 'text-[#6b4131]',
    cardBack: 'from-[#e7c8bc] via-[#d8a693] to-[#c78369]',
    label: '醫院'
  },
  bank: {
    bg: 'bg-[#d7ddc5]',
    border: 'border-[#8c9a67]',
    surface: 'from-[#e8eddc] via-[#d2d9b5] to-[#b5c087]',
    bevel: 'from-white/70 via-white/18 to-[#71804c]/20',
    glow: 'shadow-[inset_0_1px_0_rgba(250,255,244,0.88),0_18px_30px_-18px_rgba(99,113,66,0.68)]',
    icon: 'text-[#627144]',
    text: 'text-[#48543a]',
    cardBack: 'from-[#d7ddc5] via-[#bfc99d] to-[#96a66e]',
    label: '銀行'
  },
  repair: {
    bg: 'bg-[#dec49e]',
    border: 'border-[#b48545]',
    surface: 'from-[#efdec2] via-[#dec098] to-[#c99c60]',
    bevel: 'from-white/70 via-white/16 to-[#99662c]/20',
    glow: 'shadow-[inset_0_1px_0_rgba(255,249,240,0.86),0_18px_30px_-18px_rgba(150,103,47,0.68)]',
    icon: 'text-[#8b6431]',
    text: 'text-[#614522]',
    cardBack: 'from-[#dec49e] via-[#d1a96d] to-[#b88442]',
    label: '維修廠'
  },
  happiness: {
    bg: 'bg-[#ead9b7]',
    border: 'border-[#bc9455]',
    surface: 'from-[#faedd1] via-[#edd5a5] to-[#ddb36a]',
    bevel: 'from-white/70 via-white/18 to-[#a57331]/20',
    glow: 'shadow-[inset_0_1px_0_rgba(255,252,244,0.9),0_18px_30px_-18px_rgba(168,118,48,0.72)]',
    icon: 'text-[#8c6832]',
    text: 'text-[#614825]',
    cardBack: 'from-[#f0dcac] via-[#e2bd6b] to-[#c99440]',
    label: '幸福卡'
  },
  news: {
    bg: 'bg-[#d7d8ce]',
    border: 'border-[#9a9985]',
    surface: 'from-[#eef0e7] via-[#d3d5c8] to-[#b4b5a1]',
    bevel: 'from-white/70 via-white/18 to-[#7e7d67]/20',
    glow: 'shadow-[inset_0_1px_0_rgba(252,252,248,0.88),0_18px_30px_-18px_rgba(110,109,90,0.62)]',
    icon: 'text-[#696750]',
    text: 'text-[#4c4a40]',
    cardBack: 'from-[#dbddd2] via-[#bfc2b1] to-[#9c9d87]',
    label: '新聞卡'
  },
  opportunity: {
    bg: 'bg-[#d7ccbb]',
    border: 'border-[#a38764]',
    surface: 'from-[#eee2d3] via-[#dac6ab] to-[#c2a17a]',
    bevel: 'from-white/70 via-white/18 to-[#8b6a45]/20',
    glow: 'shadow-[inset_0_1px_0_rgba(255,250,245,0.88),0_18px_30px_-18px_rgba(122,92,56,0.68)]',
    icon: 'text-[#765d3b]',
    text: 'text-[#544434]',
    cardBack: 'from-[#dfd1bd] via-[#c8ae86] to-[#a98255]',
    label: '機運卡'
  }
};

const DECK_TO_SQUARE_TYPE: Record<BoardCardResult['deck'], BoardSquare['type']> = {
  happiness: 'happiness',
  news: 'news',
  opportunity: 'opportunity'
};

const STOCK_SYMBOL_COLUMNS = [
  ['A10', 'A20', 'A30', 'A40'],
  ['B50', 'B60', 'B70', 'B80']
] as const;

const getSquareIcon = (square: BoardSquare, size = 18) => {
  switch (square.type) {
    case 'school':
      return <GraduationCap size={size} />;
    case 'hospital':
      return <Activity size={size} />;
    case 'bank':
      return <Landmark size={size} />;
    case 'repair':
      return <Wrench size={size} />;
    case 'news':
      return <Newspaper size={size} />;
    case 'opportunity':
      return <Sparkles size={size} />;
    default:
      return <Heart size={size} />;
  }
};

const getCardIcon = (deck: BoardCardResult['deck'], size = 30) => {
  switch (deck) {
    case 'news':
      return <Newspaper size={size} />;
    case 'opportunity':
      return <Sparkles size={size} />;
    default:
      return <Heart size={size} />;
  }
};

const getGridCoordinates = (index: number) => {
  if (index <= 13) return { column: index + 1, row: 1 };
  if (index <= 25) return { column: 14, row: index - 12 };
  if (index <= 39) return { column: 40 - index, row: 14 };
  return { column: 1, row: 53 - index };
};

const getGridPosition = (index: number) => {
  const { column, row } = getGridCoordinates(index);
  return { gridColumn: `${column}`, gridRow: `${row}` };
};

// 棋盤是口字型外圈佈局（頂/右/底/左四邊），中間是完全空白的內部區域。
// 「剩餘步數」氣泡永遠往內部空白方向顯示，不但不會疊到隔壁棋格，也不用
// 再依賴 z-index 去跟隔壁棋格的堆疊上下文搶層級。
type BadgeDirection = 'down' | 'left' | 'up' | 'right';
const getBoardEdgeInwardDirection = (index: number): BadgeDirection => {
  if (index <= 13) return 'down';   // 頂邊 → 往下（往內部）
  if (index <= 25) return 'left';   // 右邊 → 往左
  if (index <= 39) return 'up';     // 底邊 → 往上
  return 'right';                   // 左邊 → 往右
};

const BADGE_DIRECTION_CLASSES: Record<BadgeDirection, string> = {
  down: 'top-full mt-3 left-1/2 -translate-x-1/2',
  up: 'bottom-full mb-3 left-1/2 -translate-x-1/2',
  left: 'right-full mr-3 top-1/2 -translate-y-1/2',
  right: 'left-full ml-3 top-1/2 -translate-y-1/2'
};

const getAnimatedBoardPosition = (room: Room | null, playerUid: string, now: number) => {
  const boardState = room?.boardState;
  const settledPosition = boardState?.playerPositions?.[playerUid] || 0;
  const movement = boardState?.movement;

  if (!movement?.isActive || movement.playerUid !== playerUid) {
    return settledPosition;
  }

  const elapsed = Math.max(0, now - movement.startedAt);
  if (elapsed < movement.introDelayMs) {
    return movement.startPosition;
  }

  const stepElapsed = elapsed - movement.introDelayMs;
  const stepIndex = Math.min(
    movement.path.length - 1,
    Math.floor(stepElapsed / movement.stepDurationMs)
  );

  if (stepIndex < 0) {
    return movement.startPosition;
  }

  return movement.path[stepIndex] ?? movement.startPosition;
};

// 大富翁式分段移動：算出「這段還沒走完的步數」加上「事件結案後還要繼續走的步數」，
// 顯示給投影幕看剩餘部署還有幾步。
const getRemainingMovementSteps = (room: Room | null, playerUid: string, now: number): number => {
  const boardState = room?.boardState;
  const movement = boardState?.movement;
  if (!movement || movement.playerUid !== playerUid) return 0;

  const remainingAfterThisLeg = movement.remainingPath?.length || 0;

  if (!movement.isActive) {
    // 已經停靠在事件格，這段本身走完了，只剩下之後要繼續走的部分。
    return remainingAfterThisLeg;
  }

  const elapsed = Math.max(0, now - movement.startedAt);
  if (elapsed < movement.introDelayMs) {
    return movement.path.length + remainingAfterThisLeg;
  }

  const stepElapsed = elapsed - movement.introDelayMs;
  const stepIndex = Math.min(
    movement.path.length - 1,
    Math.floor(stepElapsed / movement.stepDurationMs)
  );
  const remainingInThisLeg = Math.max(0, movement.path.length - 1 - stepIndex);

  return remainingInThisLeg + remainingAfterThisLeg;
};

const getAvatarStyle = (player: { photoPosition?: string; photoScale?: string }) => {
  let position = { x: 50, y: 50 };
  let scale = 1;

  if (player.photoPosition) {
    try {
      const parsed = typeof player.photoPosition === 'string' ? JSON.parse(player.photoPosition) : player.photoPosition;
      position = {
        x: parsed?.x ?? 50,
        y: parsed?.y ?? 50
      };
    } catch {
      position = { x: 50, y: parseInt(player.photoPosition, 10) || 50 };
    }
  }

  if (player.photoScale) {
    scale = parseFloat(player.photoScale) || 1;
  }

  return {
    objectPosition: `${position.x}% ${position.y}%`,
    transform: `scale(${scale})`
  };
};

const renderPlayerToken = (player: {
  name: string;
  photoURL?: string;
  photoPosition?: string;
  photoScale?: string;
}, isMoving: boolean = false) => {
  const isCustomAvatar = !!player.photoURL && (player.photoURL.startsWith('http') || player.photoURL.startsWith('data:image'));

  if (!isCustomAvatar) {
    return (
      <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-[#f8dfb5] to-[#c78f47] shadow-inner ${isMoving ? 'text-2xl' : 'text-base'}`}>
        🐝
      </div>
    );
  }

  return (
    <SafeImage
      src={player.photoURL}
      alt={player.name}
      className="h-full w-full object-cover"
      style={getAvatarStyle(player)}
    />
  );
};

// 卡片 UI/UX 重整：把 effectLines 裡「真正影響玩家的數字」（現金/幸福/月支出等）
// 挑出來做成大字效果摘要條，跟流程/規則類的文字（需要選擇、財務檢核…）分開，
// 讓數字變成整張卡的視覺焦點，而不是跟故事文案、規則說明混在一起。
type ImpactTone = 'expense' | 'income' | 'happiness' | 'happiness-negative';

interface ParsedImpactLine {
  key: string;
  label: string;
  value: string;
  tone: ImpactTone;
}

const IMPACT_LINE_MATCHERS: Array<{ prefix: string; label: string; tone: ImpactTone | ((line: string) => ImpactTone) }> = [
  { prefix: '現金 -', label: '現金支出', tone: 'expense' },
  { prefix: '現金 +', label: '現金收入', tone: 'income' },
  { prefix: '一次性支出', label: '一次性支出', tone: 'expense' },
  { prefix: '幸福 +', label: '幸福', tone: 'happiness' },
  { prefix: '幸福 -', label: '幸福', tone: 'happiness-negative' },
  { prefix: '自用幸福：+', label: '幸福', tone: 'happiness' },
  { prefix: '月支出', label: '月支出調整', tone: 'expense' },
  { prefix: '保險理賠', label: '保險理賠', tone: 'income' },
  { prefix: '租金收入（月）', label: '月租金收入', tone: 'income' },
  { prefix: '企業貸款利息（月）', label: '企業貸款利息', tone: 'expense' },
  { prefix: '貸款利息（月）', label: '貸款利息', tone: 'expense' },
  { prefix: '淨收益（月）', label: '月淨收益', tone: line => (line.includes('-') ? 'expense' : 'income') }
];

const parseImpactLines = (lines: string[]): { impacts: ParsedImpactLine[]; rest: string[] } => {
  const impacts: ParsedImpactLine[] = [];
  const rest: string[] = [];

  lines.forEach((line, index) => {
    const matcher = IMPACT_LINE_MATCHERS.find(m => line.startsWith(m.prefix));
    if (!matcher) {
      rest.push(line);
      return;
    }
    const value = line.slice(matcher.prefix.length).replace(/^[：:\s]+/, '').trim();
    const tone = typeof matcher.tone === 'function' ? matcher.tone(line) : matcher.tone;
    impacts.push({ key: `${line}_${index}`, label: matcher.label, value, tone });
  });

  return { impacts, rest };
};

// 泛用版「標籤：數值」解析，套用在還沒被 parseImpactLines 吃掉的
// effectLines 上。原本股票新聞卡才有的表格化呈現（標籤置頂、數值置右、
// 大字級），推廣成所有卡片的預設樣式，取代整段文字塞格子；沒有冒號的
// 行就當作說明文字，原樣呈現。
interface ParsedLabelValueLine { key: string; label: string | null; value: string; }
const parseLabelValueLines = (lines: string[]): ParsedLabelValueLine[] => {
  return lines.map((line, index) => {
    const separatorIndex = line.search(/[：:]/);
    if (separatorIndex === -1) {
      return { key: `${line}_${index}`, label: null, value: line };
    }
    const label = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!label || !value) {
      return { key: `${line}_${index}`, label: null, value: line };
    }
    return { key: `${line}_${index}`, label, value };
  });
};

const EffectLineChip: React.FC<{ line: ParsedLabelValueLine }> = ({ line }) => (
  <div className="rounded-[14px] border border-[#ead6b9] bg-[#fffdf8] px-4 py-2.5">
    {line.label && (
      <div className="text-[10px] font-black tracking-[0.14em] text-[#a4835b]">{line.label}</div>
    )}
    <div className={`font-black leading-snug text-[#5f4933] whitespace-pre-wrap break-words ${line.label ? 'text-base' : 'text-sm'}`}>
      {line.value}
    </div>
  </div>
);

const IMPACT_TONE_STYLE: Record<ImpactTone, { bg: string; text: string; icon: React.ReactNode }> = {
  expense: { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', icon: <TrendingDown size={18} /> },
  income: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: <TrendingUp size={18} /> },
  happiness: { bg: 'bg-pink-50 border-pink-200', text: 'text-pink-600', icon: <Heart size={18} /> },
  'happiness-negative': { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', icon: <HeartCrack size={18} /> }
};

const ImpactSummaryBar: React.FC<{ impacts: ParsedImpactLine[] }> = ({ impacts }) => {
  if (!impacts.length) return null;

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {impacts.map(impact => {
        const style = IMPACT_TONE_STYLE[impact.tone];
        return (
          <div
            key={impact.key}
            className={`flex items-center gap-2 rounded-[16px] border-2 px-3 py-2.5 ${impact.label === '月支出調整' ? 'col-span-full' : ''} ${style.bg}`}
          >
            <span className={style.text}>{style.icon}</span>
            <div className="min-w-0">
              <div className="truncate text-[10px] font-black uppercase tracking-wider text-[#9c7c58]">{impact.label}</div>
              <div className={`break-words text-[clamp(1.1rem,2.4vw,1.5rem)] font-black leading-tight ${style.text}`}>{impact.value}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// 底部狀態列：讓全場看得懂「現在卡在哪一步」，而不是只看到一張靜止的卡。
const getCardStatusLabel = (params: {
  isRevealed: boolean;
  drawerName: string;
  cardId?: string;
  sharedPrompt?: { sourceCardId: string; targetPlayerUids: string[]; responses?: Record<string, unknown> } | null;
  familyPrompt?: { sourceCardId: string; targetPlayerUids: string[]; responses?: Record<string, unknown> } | null;
}): string => {
  const { isRevealed, drawerName, cardId, sharedPrompt, familyPrompt } = params;

  if (!isRevealed) return `等待 ${drawerName} 翻牌`;

  if (familyPrompt && familyPrompt.sourceCardId === cardId) {
    const total = familyPrompt.targetPlayerUids.length;
    const responded = familyPrompt.targetPlayerUids.filter(uid => !!familyPrompt.responses?.[uid]).length;
    if (responded < total) return `等待其他玩家共同參與回覆（${responded}/${total}）`;
  }

  if (sharedPrompt && sharedPrompt.sourceCardId === cardId) {
    const total = sharedPrompt.targetPlayerUids.length;
    const responded = sharedPrompt.targetPlayerUids.filter(uid => !!sharedPrompt.responses?.[uid]).length;
    if (responded < total) return `等待玩家回覆（${responded}/${total}）`;
  }

  return `等待 ${drawerName} 完成處理`;
};

const CardStage: React.FC<{
  card: BoardCardResult | null;
  isRevealed: boolean;
  drawerName?: string;
  statusLabel?: string;
}> = ({ card, isRevealed, drawerName, statusLabel }) => {
  if (!card) return null;

  const presentation = toCardPresentationModel(card);

  const theme = SQUARE_THEME[DECK_TO_SQUARE_TYPE[presentation.deck]];
  const normalizedDescription = getCardNarrative(normalizeCardCopy(presentation.description), presentation.effectLines);
  const flavorText = (() => {
    const starIndex = normalizedDescription.indexOf('*');
    return starIndex === -1 ? normalizedDescription : normalizedDescription.substring(0, starIndex).trim();
  })();
  const ruleText = (() => {
    const starIndex = normalizedDescription.indexOf('*');
    return starIndex === -1 ? '' : normalizedDescription.substring(starIndex).replace(/\*/g, '').trim();
  })();
  const normalizedEffectLines = presentation.effectLines.map(line => normalizeCardCopy(line));
  const familyMilestoneStatus = presentation.familyMilestoneStatus;
  const isFamilyMilestoneCard =
    presentation.deck === 'happiness' &&
    presentation.subtitle === '家庭重要歷程';
  const familyMilestoneStages = familyMilestoneStatus?.stages?.length
    ? familyMilestoneStatus.stages
    : FAMILY_MILESTONE_STAGES;
  const familyMilestoneIntro = '抽到卡片的玩家可自由決定是否依序完成家庭重要歷程；其他玩家擲骰達 4 點以上即可參與。';
  const realEstateCard = presentation.deck === 'news' ? NEWS_CARD_MAP[presentation.cardId] : null;
  const realEstateMetrics = realEstateCard?.type === 'real_estate'
    ? [
        { label: '房屋總價', value: realEstateCard.totalPrice.toLocaleString(), className: 'col-span-2' },
        { label: '頭期款', value: realEstateCard.downPayment.toLocaleString(), className: '' },
        { label: '房屋貸款', value: realEstateCard.loanAmount.toLocaleString(), className: '' },
        { label: '貸款月利息', value: realEstateCard.monthlyPayment.toLocaleString(), className: '' },
        { label: '租金收入', value: realEstateCard.rent.toLocaleString(), className: '' },
        { label: '幸福點（自用）', value: `+${realEstateCard.happinessBonus}`, className: '' },
        { label: '月淨收益', value: `${realEstateCard.netRentIncome > 0 ? '+' : ''}${realEstateCard.netRentIncome.toLocaleString()}`, className: '' }
      ]
    : null;
  const { impacts, rest: remainingEffectLines } = parseImpactLines(normalizedEffectLines);
  const stockSymbolCount = STOCK_SYMBOL_COLUMNS.flat().length;
  const stockPriceLineCount = remainingEffectLines.filter(line =>
    STOCK_SYMBOL_COLUMNS.flat().some(symbol => line.startsWith(`${symbol}：`))
  ).length;
  const stockEffectMap = remainingEffectLines.reduce<Record<string, string>>((acc, line) => {
    const [label, ...rest] = line.split('：');
    if (!label || rest.length === 0) return acc;
    acc[label.trim()] = rest.join('：').trim();
    return acc;
  }, {});
  const isStockCard = card.deck === 'news' && stockPriceLineCount === stockSymbolCount;
  const parsedEffectLines = parseLabelValueLines(remainingEffectLines);
  // 沒有冒號的整句敘述（例如規則說明）不適合塞進「標籤：數值」的緊湊格子，
  // 併到下方規則框一起呈現；格子區只留真正結構化的標籤/數值資料。
  const labeledEffectLines = parsedEffectLines.filter(line => line.label !== null);
  const sentenceEffectLines = parsedEffectLines.filter(line => line.label === null).map(line => line.value);
  const combinedRuleText = [ruleText, ...(isStockCard ? [] : sentenceEffectLines)].filter(Boolean).join('\n');
  const stockSummaryCaption = isStockCard ? sentenceEffectLines.filter(Boolean).join(' ') : '';

  return (
    <div className="w-[calc(100vw-32px)] max-w-[560px]" style={{ perspective: '1400px' }}>
      <div
        className={`relative w-full transition-transform duration-700 ${
          isFamilyMilestoneCard
            ? 'h-[min(78vh,700px)] min-h-[420px]'
            : 'h-[min(78vh,760px)] min-h-[420px]'
        }`}
        style={{
          transformStyle: 'preserve-3d',
          transform: isRevealed ? 'rotateY(180deg)' : 'rotateY(0deg)'
        }}
      >
        <div
          className={`absolute inset-0 overflow-hidden rounded-[28px] border-2 border-white/70 bg-gradient-to-br ${theme.cardBack} shadow-[0_26px_60px_-32px_rgba(91,62,31,0.8)]`}
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="absolute inset-[12px] rounded-[20px] border border-white/60" />
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle, #5b4127 1px, transparent 1px)', backgroundSize: '14px 14px' }} />
          <div className="relative z-10 flex h-full flex-col items-center justify-center gap-4 text-white drop-shadow-[0_3px_8px_rgba(70,45,22,0.45)]">
            <div className="rounded-3xl border border-white/40 bg-white/15 p-5">
              {getCardIcon(card.deck, 46)}
            </div>
            <div className="text-3xl font-black tracking-[0.28em]">{theme.label}</div>
          </div>
        </div>

        <div
          className="absolute inset-0 overflow-hidden rounded-[28px] border border-[#d4b68d] bg-[#fffaf2] text-[#4f3c29] shadow-[0_26px_60px_-32px_rgba(91,62,31,0.8)]"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className={`h-3 bg-gradient-to-r ${theme.cardBack}`} />
          <div className={`flex h-[calc(100%-12px)] min-h-0 flex-col overflow-hidden ${isFamilyMilestoneCard ? 'p-4 sm:p-5' : 'p-4 sm:p-6'}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-black tracking-[0.24em] text-[#9c7c58]">
                {getCardIcon(card.deck, 18)}
                <span>{card.subtitle && card.subtitle !== theme.label ? `${theme.label}・${card.subtitle}` : theme.label}</span>
                {drawerName && <span className="text-[#c2a374]">・{drawerName} 抽到</span>}
              </div>
              <span className="shrink-0 text-[10px] font-bold tracking-widest text-[#c2a374]">{card.cardId}</span>
            </div>
            <div className={`mt-3 break-words font-black leading-[1.05] ${isFamilyMilestoneCard ? 'text-[clamp(2.5rem,5.8vw,4.4rem)]' : 'text-[clamp(2rem,7vw,3rem)]'}`}>
              {isFamilyMilestoneCard ? '幸福家庭的重要歷程' : card.title}
            </div>
            {!isFamilyMilestoneCard && !realEstateMetrics && <ImpactSummaryBar impacts={impacts} />}
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1 no-scrollbar">
              {flavorText && !isFamilyMilestoneCard && (
                <p className="whitespace-pre-wrap break-words border-l-2 border-[#e5cfac] pl-3 text-xs italic leading-relaxed text-[#a4896c] sm:text-sm">
                  {flavorText}
                </p>
              )}
              {realEstateMetrics && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {realEstateMetrics.map(metric => (
                    <div key={metric.label} className={`rounded-[16px] border border-[#ead6b9] bg-[#fffdf8] px-4 py-3 ${metric.className}`}>
                      <div className="text-[10px] font-black tracking-[0.14em] text-[#a4835b]">{metric.label}</div>
                      <div className="mt-1 break-words text-[clamp(1.25rem,3.2vw,1.75rem)] font-black leading-tight text-[#5f4933]">{metric.value}</div>
                    </div>
                  ))}
                </div>
              )}
              {combinedRuleText && !isFamilyMilestoneCard && (
                <div className="mt-4 rounded-[18px] border border-[#e5cfac] bg-[#fff6e6] px-4 py-4 text-sm font-bold leading-relaxed text-[#6f5336] whitespace-pre-wrap break-words">
                  {combinedRuleText}
                </div>
              )}
              {isStockCard && stockSummaryCaption && (
                <div className="mt-2 text-[11px] font-semibold italic text-[#a4896c]">
                  {stockSummaryCaption}
                </div>
              )}
              {isFamilyMilestoneCard ? (
                <div className="mt-3 space-y-3">
                  <p className="whitespace-pre-wrap break-words rounded-[18px] border border-[#e5cfac] bg-[#fff6e6] px-4 py-3 text-sm font-bold leading-relaxed text-[#6f5336]">
                    {familyMilestoneIntro}
                  </p>
                  <div className="rounded-[18px] border border-[#e7d5bb] bg-white/90 p-3">
                    <div className="mb-1.5 flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-[10px] font-black tracking-[0.22em] text-[#9c7c58]">
                        各階段花費
                      </div>
                    </div>

                    <div className="mb-1 grid grid-cols-[minmax(0,1.7fr)_minmax(0,0.95fr)] gap-2 px-1 text-[9px] font-black tracking-[0.1em] text-[#a4835b]">
                      <div>階段</div>
                      <div>花費</div>
                    </div>
                    <div className="overflow-hidden rounded-[16px] border border-[#ead6b9] bg-[#fffdf8]">
                      {familyMilestoneStages.map((stage: any, index: number) => {
                        return (
                          <div
                            key={`${card.cardId}_${stage.cardId}`}
                            className={`grid grid-cols-[minmax(0,1.7fr)_minmax(0,0.95fr)] items-center gap-2 px-3 py-2 transition-all ${
                              index % 2 === 0 ? 'bg-[#fffdf8]' : 'bg-[#fff9f0]'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="break-words text-[12px] font-black leading-tight text-[#5b4127] sm:text-[13px]">
                                {stage.label}
                              </div>
                            </div>
                            <div className="min-w-0 break-words text-[11px] font-black leading-tight text-[#7a5a37] sm:text-[12px]">
                              {stage.cost}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : !realEstateMetrics && (isStockCard ? !!remainingEffectLines.length : !!labeledEffectLines.length) && (
                isStockCard ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {STOCK_SYMBOL_COLUMNS.map((column, columnIndex) => (
                      <div key={`${card.cardId}_column_${columnIndex}`} className="rounded-[18px] border border-[#ead6b9] bg-[#fffdf8] p-3">
                        <div className="space-y-2">
                          {column.map(symbol => (
                            <div key={`${card.cardId}_${symbol}`} className="flex items-center justify-between gap-3 rounded-[12px] border border-[#f0e2ca] bg-white px-3 py-2 text-sm font-black text-[#5f4933]">
                              <div className="min-w-0 truncate">
                                {symbol} {STOCK_NAMES[symbol] || '未命名股票'}
                              </div>
                              <span className="text-right">{stockEffectMap[symbol] || '-'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {labeledEffectLines.map(line => (
                      <EffectLineChip key={line.key} line={line} />
                    ))}
                  </div>
                )
              )}
            </div>
            {statusLabel && (
              <div className="mt-3 shrink-0 rounded-[14px] border border-[#e5cfac] bg-[#f4e6d0]/70 px-3 py-2 text-center text-xs font-black tracking-[0.06em] text-[#76573a]">
                {statusLabel}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const BoardProjectionView: React.FC<{ roomCode: string }> = ({ roomCode }) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [zoom, setZoom] = useState(FIT_ZOOM_FALLBACK);
  const [animationNow, setAnimationNow] = useState(() => Date.now());
  const [showBoardCardLog, setShowBoardCardLog] = useState(false);
  const [visibleSkippedTurnNotice, setVisibleSkippedTurnNotice] = useState<SkippedTurnNotice | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const boardFrameRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);

  const computeFitZoom = React.useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return FIT_ZOOM_FALLBACK;
    const vw = viewport.clientWidth - VIEWPORT_PADDING_X;
    const vh = viewport.clientHeight - VIEWPORT_PADDING_TOP - VIEWPORT_PADDING_BOTTOM;
    return Math.min(vw / BOARD_WIDTH, vh / BOARD_HEIGHT);
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'rooms', roomCode), snapshot => {
      setRoom(snapshot.exists() ? snapshot.data() as Room : null);
    });

    return () => unsubscribe();
  }, [roomCode]);

  useEffect(() => {
    const movement = room?.boardState?.movement;
    if (!movement?.isActive) return;

    setAnimationNow(Date.now());
    const intervalId = window.setInterval(() => {
      setAnimationNow(Date.now());
    }, BOARD_MOVEMENT_TICK_MS);

    return () => window.clearInterval(intervalId);
  }, [room?.boardState?.movement]);

  useEffect(() => {
    const notice = room?.boardState?.skippedTurnNotice;
    if (!notice) return;

    const remainingMs = SKIPPED_TURN_NOTICE_MS - (Date.now() - notice.timestamp);
    if (remainingMs <= 0) {
      setVisibleSkippedTurnNotice(null);
      return;
    }

    setVisibleSkippedTurnNotice(notice);
    const timeoutId = window.setTimeout(() => setVisibleSkippedTurnNotice(null), remainingMs);
    return () => window.clearTimeout(timeoutId);
  }, [room?.boardState?.skippedTurnNotice?.timestamp]);

  const players = useMemo(() => {
    if (!room?.boardState) return [];
    // 正常情況下 turnOrder 已涵蓋所有玩家。但因為 turnOrder 是在「開始遊戲」
    // 那一刻寫死的，若當下有玩家剛加入、尚未同步到房主端就開局，理論上會被
    // 房主端的自動補齊機制（healMissingTurnOrderPlayers）修正回來，但那需要
    // 等房主端的 Firestore 監聽收到更新才會觸發。這裡在畫面層再加一層保險：
    // 只要 room.members 裡有非「這場遊戲主持人」的成員不在 turnOrder，也照樣
    // 畫出棋偶，避免補齊機制還沒跑完之前，投影幕地圖暫時性地漏人。
    // 注意：判斷是不是玩家要看「是不是這場的房主」（room.hostId），不能看
    // 帳號的全域角色（role）——執行師帳號也可能以參與者身分加入別人的房間。
    const uids = [
      ...room.boardState.turnOrder,
      ...room.members
        .filter(member => member.uid !== room.hostId && !room.boardState!.turnOrder.includes(member.uid))
        .map(member => member.uid)
    ];
    return uids.map(uid => {
      const member = room.members.find(item => item.uid === uid);
      return {
        uid,
        name: member?.name || '玩家',
        photoURL: member?.photoURL,
        photoPosition: member?.photoPosition,
        photoScale: member?.photoScale,
        position: getAnimatedBoardPosition(room, uid, animationNow)
      };
    });
  }, [room, animationNow]);

  const playerGroups = useMemo(() => {
    return BOARD_SQUARES.reduce<Record<number, typeof players>>((acc, square) => {
      acc[square.index] = players.filter(player => player.position === square.index);
      return acc;
    }, {});
  }, [players]);

  const setZoomAroundPoint = (nextZoom: number, clientX?: number, clientY?: number) => {
    const viewport = viewportRef.current;
    if (!viewport) {
      setZoom(nextZoom);
      return;
    }

    const rect = viewport.getBoundingClientRect();
    const anchorX = clientX ?? rect.left + rect.width / 2;
    const anchorY = clientY ?? rect.top + rect.height / 2;
    const contentX = (viewport.scrollLeft + anchorX - rect.left) / zoom;
    const contentY = (viewport.scrollTop + anchorY - rect.top) / zoom;

    setZoom(nextZoom);

    requestAnimationFrame(() => {
      viewport.scrollLeft = contentX * nextZoom - (anchorX - rect.left);
      viewport.scrollTop = contentY * nextZoom - (anchorY - rect.top);
    });
  };

  // 視窗 resize 或第一次掛載時，重新計算 fitZoom 作為初始縮放
  useEffect(() => {
    const apply = () => {
      const fit = computeFitZoom();
      setZoom(fit);
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;

      event.preventDefault();
      const delta = -event.deltaY * 0.0025;
      const fitZoom = computeFitZoom();
      const nextZoom = Math.min(1.4, Math.max(fitZoom, Number((zoom + delta).toFixed(3))));
      setZoomAroundPoint(nextZoom, event.clientX, event.clientY);
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, [zoom]);

  const currentTurnUid = room?.boardState?.currentTurnUid || null;
  const currentTurnPosition = currentTurnUid
    ? players.find(player => player.uid === currentTurnUid)?.position ?? null
    : null;
  const movement = room?.boardState?.movement;
  const movingPlayerPosition = movement
    ? players.find(player => player.uid === movement.playerUid)?.position ?? movement.startPosition
    : null;
  const focusUid = movement?.isActive ? movement.playerUid : currentTurnUid;
  const focusPosition = movement?.isActive ? movingPlayerPosition : currentTurnPosition;
  const boardCardLog = useMemo(() => {
    return (room?.boardState?.cardLog || []).slice(0, 12) as BoardCardLogEntry[];
  }, [room]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const boardFrame = boardFrameRef.current;
    if (!viewport || !boardFrame || focusPosition === null) return;

    const { column, row } = getGridCoordinates(focusPosition);
    const tileCenterX = BOARD_PADDING + (column - 1) * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2;
    const tileCenterY = BOARD_PADDING + (row - 1) * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2;

    requestAnimationFrame(() => {
      const targetLeft = boardFrame.offsetLeft + tileCenterX * zoom - viewport.clientWidth / 2;
      const targetTop = boardFrame.offsetTop + tileCenterY * zoom - viewport.clientHeight / 2;
      const maxLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      const maxTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);

      viewport.scrollTo({
        left: Math.min(maxLeft, Math.max(0, targetLeft)),
        top: Math.min(maxTop, Math.max(0, targetTop)),
        behavior: 'smooth'
      });
    });
  }, [focusUid, focusPosition, zoom]);

  if (!room) {
    return <div className="flex h-screen items-center justify-center bg-[#efe2ce] text-[#5a4430]">找不到房間 {roomCode}</div>;
  }

  if (room.status === 'finished') {
    return (
      <div className="flex min-h-screen items-center justify-center overflow-y-auto bg-slate-950 p-4 text-white">
        <SettlementView players={buildSettlementPlayers(room)} showPrivateRecap={false} />
      </div>
    );
  }

  const boardState = room.boardState;
  const roomName = room.name || '蜂富人生';
  const currentTurnName = room.members.find(member => member.uid === boardState?.currentTurnUid)?.name || '尚未開始';
  const skippedTurnNames = visibleSkippedTurnNotice?.playerUids
    .map(uid => room.members.find(member => member.uid === uid)?.name || '玩家') || [];
  const nextTurnName = visibleSkippedTurnNotice
    ? room.members.find(member => member.uid === visibleSkippedTurnNotice.nextTurnUid)?.name || currentTurnName
    : currentTurnName;
  const currentPlayerState = boardState?.currentEvent?.playerUid
    ? room.playerStates?.[boardState.currentEvent.playerUid] || null
    : null;
  const currentCard = currentPlayerState
    ? hydrateBoardCardResult(boardState?.currentCard || null, currentPlayerState)
    : boardState?.currentCard || null;
  const revealState = boardState?.currentCardReveal;
  const isCardRevealed = !!(
    currentCard &&
    revealState?.eventId === boardState?.currentEvent?.id &&
    revealState?.cardId === currentCard.cardId &&
    revealState?.isRevealed
  );
  const currentDrawerName = boardState?.currentEvent?.playerUid
    ? room.members.find(member => member.uid === boardState.currentEvent?.playerUid)?.name || '玩家'
    : '玩家';
  const cardStatusLabel = currentCard
    ? getCardStatusLabel({
        isRevealed: isCardRevealed,
        drawerName: currentDrawerName,
        cardId: currentCard.cardId,
        sharedPrompt: boardState?.sharedCardPrompt || null,
        familyPrompt: boardState?.familyMilestoneJoinPrompt || null
      })
    : '';
  const zoomPercent = Math.round(zoom * 100);
  const scaledBoardWidth = BOARD_WIDTH * zoom;
  const scaledBoardHeight = BOARD_HEIGHT * zoom;

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport || event.button !== 0) return;

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop
    };
    viewport.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    const dragState = dragStateRef.current;
    if (!viewport || !dragState || dragState.pointerId !== event.pointerId) return;

    viewport.scrollLeft = dragState.scrollLeft - (event.clientX - dragState.startX);
    viewport.scrollTop = dragState.scrollTop - (event.clientY - dragState.startY);
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    const dragState = dragStateRef.current;
    if (!viewport || !dragState || dragState.pointerId !== event.pointerId) return;

    dragStateRef.current = null;
    if (viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    setZoomAroundPoint(zoom < 1 ? 1 : computeFitZoom(), event.clientX, event.clientY);
  };

  return (
    <div
      ref={viewportRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onDoubleClick={handleDoubleClick}
      className="h-screen cursor-grab overflow-auto bg-[radial-gradient(circle_at_top,#f8f1e5_0%,#efe2ce_45%,#e5d2b5_100%)] text-[#4f3c29] active:cursor-grabbing"
    >
      {visibleSkippedTurnNotice && (
        <motion.div
          key={visibleSkippedTurnNotice.timestamp}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="pointer-events-none fixed inset-0 z-[10040] flex items-center justify-center bg-[#4f3c29]/45 backdrop-blur-sm"
        >
          <motion.div
            initial={{ y: 24, scale: 0.92 }}
            animate={{ y: 0, scale: 1 }}
            className="min-w-[420px] rounded-[36px] border-2 border-[#f3d7ac] bg-[linear-gradient(180deg,#fff9ef,#f0dfc4)] px-12 py-10 text-center shadow-[0_30px_80px_-28px_rgba(62,43,25,0.9)]"
          >
            <div className="text-sm font-black tracking-[0.3em] text-[#a17a4d]">暫停回合</div>
            <div className="mt-3 text-4xl font-black text-[#5a4028]">{skippedTurnNames.join('、')}</div>
            <div className="mt-3 text-xl font-bold text-[#8a6744]">本回合暫停，無法行動</div>
            <div className="mt-6 rounded-full bg-[#e7cfaa]/65 px-5 py-3 text-base font-black text-[#65492f]">
              接著輪到 {nextTurnName}
            </div>
          </motion.div>
        </motion.div>
      )}

      <div
        onPointerDown={event => event.stopPropagation()}
        onDoubleClick={event => event.stopPropagation()}
        className="fixed left-1/2 top-5 z-50 flex -translate-x-1/2 items-center gap-6 rounded-full border border-[#d2b58c] bg-[linear-gradient(180deg,rgba(255,251,244,0.98),rgba(242,228,204,0.96))] px-6 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_18px_36px_-28px_rgba(92,64,33,0.65)]"
      >
        <div className="flex flex-col items-center">
          <div className="text-[10px] font-black tracking-[0.2em] text-[#9c7c58]">{roomName}</div>
          <div className="text-lg font-black tracking-widest text-[#4f3c29]">{room.id}</div>
        </div>
        <div className="h-8 w-px bg-[#d9bd98]" />
        <div className="flex flex-col items-center">
          <div className="text-[10px] font-black tracking-[0.2em] text-[#9c7c58]">目前回合</div>
          <div className="text-lg font-black text-[#4f3c29]">{visibleSkippedTurnNotice ? '暫停回合處理中' : currentTurnName}</div>
        </div>
      </div>

      <div
        className="fixed right-5 top-5 z-[10031]"
        onPointerDown={event => event.stopPropagation()}
        onDoubleClick={event => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setShowBoardCardLog(prev => !prev)}
          className="flex items-center gap-2 rounded-full border border-[#d2b58c] bg-[linear-gradient(180deg,rgba(255,251,244,0.98),rgba(242,228,204,0.96))] px-4 py-3 text-sm font-black text-[#4f3c29] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_18px_36px_-28px_rgba(92,64,33,0.65)]"
        >
          <ScrollText size={16} className="text-[#9c7c58]" />
          <span>抽卡日誌</span>
          <span className="rounded-full bg-[#f4e6d0] px-2 py-0.5 text-xs text-[#76573a]">
            {boardCardLog.length}
          </span>
        </button>
      </div>

      {showBoardCardLog && (
        <div
          onPointerDown={event => event.stopPropagation()}
          onDoubleClick={event => event.stopPropagation()}
        >
          <BoardCardLogPanel
            entries={boardCardLog}
            onClose={() => setShowBoardCardLog(false)}
          />
        </div>
      )}

      <div
        className="min-h-full min-w-full"
        style={{
          width: `max(100%, ${scaledBoardWidth + VIEWPORT_PADDING_X}px)`,
          height: `max(100%, ${scaledBoardHeight + VIEWPORT_PADDING_TOP + VIEWPORT_PADDING_BOTTOM}px)`,
          padding: `${VIEWPORT_PADDING_TOP}px ${VIEWPORT_PADDING_X / 2}px ${VIEWPORT_PADDING_BOTTOM}px`
        }}
      >
        <div
          ref={boardFrameRef}
          className="mx-auto shrink-0"
          style={{ width: `${scaledBoardWidth}px`, height: `${scaledBoardHeight}px` }}
        >
          <main
            className="relative shrink-0 overflow-hidden rounded-[34px] border border-[#d2b58c] bg-[linear-gradient(180deg,#fbf4ea_0%,#f2e2ca_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_30px_70px_-42px_rgba(105,75,42,0.58)]"
            style={{
              width: BOARD_WIDTH,
              height: BOARD_HEIGHT,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left'
            }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(255,248,235,0.96),rgba(241,222,195,0.95)_55%,rgba(227,203,166,0.94)_100%)]">
              <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'linear-gradient(rgba(148,112,70,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,112,70,0.08) 1px, transparent 1px)', backgroundSize: '34px 34px' }} />
              <div className="absolute inset-[4.5%] rounded-[28px] border border-[#d6bc96]/80 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55)]" />
              <div className="absolute inset-[9%] rounded-[24px] border border-dashed border-[#cfb28a] bg-[#fffaf2]/78 shadow-[inset_0_0_50px_rgba(219,190,147,0.18)]" />
            </div>

            <div
              className="absolute grid grid-cols-[repeat(14,126px)] grid-rows-[repeat(14,126px)] gap-4"
              style={{ left: BOARD_PADDING, top: BOARD_PADDING }}
            >
              {BOARD_SQUARES.map(square => {
                const theme = SQUARE_THEME[square.type];
                const groupedPlayers = playerGroups[square.index] || [];
                const hasPlayers = groupedPlayers.length > 0;
                const isCorner = square.type === 'school' || square.type === 'hospital';
                const isCurrentEventSquare = movement?.isActive
                  ? movingPlayerPosition === square.index
                  : boardState?.currentEvent?.squareIndex === square.index;
                const badgeDirection = getBoardEdgeInwardDirection(square.index);
                // 這個棋格上有玩家正顯示「剩餘步數」氣泡時，把棋格自己的堆疊層級
                // 拉到最高，確保氣泡（巢狀在棋格的堆疊上下文內）不會被隔壁棋格蓋過。
                const hasRemainingBadge = groupedPlayers.some(player => {
                  const isMoving = movement?.isActive && movement.playerUid === player.uid;
                  const isPausedMidMove = !movement?.isActive && movement?.playerUid === player.uid && (movement?.remainingPath?.length ?? 0) > 0;
                  return isMoving || isPausedMidMove;
                });

                return (
                  <div
                    key={square.id}
                    className={[
                      'relative flex h-[126px] w-[126px] flex-col items-center justify-center border text-center transition-all duration-300',
                      isCorner ? 'rounded-[20px]' : 'rounded-[14px]',
                      isCurrentEventSquare ? 'z-20 -translate-y-1 ring-[3px] ring-[#8f6a3b]/45 shadow-[0_22px_40px_-20px_rgba(117,83,42,0.8)]' : 'hover:-translate-y-0.5',
                      theme.bg,
                      theme.border,
                      theme.glow,
                      hasRemainingBadge ? 'z-40' : (hasPlayers ? 'z-30' : 'z-10')
                    ].join(' ')}
                    style={getGridPosition(square.index)}
                  >
                    <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
                      <div className={`absolute inset-0 bg-gradient-to-br ${theme.surface}`} />
                      <div className={`absolute inset-[1px] rounded-[inherit] bg-gradient-to-br ${theme.bevel} opacity-90`} />
                      <div className="absolute inset-x-[10px] top-[8px] h-[22px] rounded-full bg-white/28 blur-md" />
                      <div className="absolute inset-x-0 bottom-0 h-[30px] bg-gradient-to-t from-[#8f6a3b]/10 to-transparent" />
                    </div>
                    <div className={`${theme.icon} relative z-10 mb-2`}>
                      {getSquareIcon(square, isCorner ? 30 : 24)}
                    </div>
                    <div className={`relative z-10 text-[22px] font-black leading-none drop-shadow-[0_1px_0_rgba(255,255,255,0.3)] ${theme.text}`}>
                      {square.label}
                    </div>

                    {hasPlayers && (
                      <div className="pointer-events-none absolute bottom-0 left-1/2 flex w-[140px] -translate-x-1/2 translate-y-1/3 flex-wrap justify-center gap-1">
                        {groupedPlayers.slice(0, 6).map((player, idx) => {
                          const isMoving = movement?.isActive && movement.playerUid === player.uid;
                          const isCurrentTurn = currentTurnUid === player.uid;
                          // 頂端提示已移除，改成完全跟著棋偶走的浮動氣泡：只要這位玩家還在
                          // 移動中，或是移動暫停在「經過事件」等待處理（remainingPath 還有
                          // 剩餘步數），就顯示氣泡，涵蓋原本頂端提示涵蓋的兩種狀態。
                          const isPausedMidMove = !movement?.isActive && movement?.playerUid === player.uid && (movement?.remainingPath?.length ?? 0) > 0;
                          const showRemainingBadge = isMoving || isPausedMidMove;
                          return (
                            <div key={player.uid} className="relative" style={{ zIndex: isMoving ? 100 : isCurrentTurn ? 40 : 30 - idx }}>
                              {showRemainingBadge && (
                                <div
                                  className={`pointer-events-none absolute z-[110] whitespace-nowrap rounded-full border border-[#ffefd6] bg-[#4f3c29] px-4 py-2 text-center shadow-[0_8px_16px_-6px_rgba(0,0,0,0.6)] ${BADGE_DIRECTION_CLASSES[badgeDirection]}`}
                                >
                                  <div className="text-[10px] font-black tracking-[0.2em] text-[#e8c795]">
                                    {isMoving ? '移動中' : '停靠處理中'}
                                  </div>
                                  <div className="text-sm font-black text-[#ffefd6]">
                                    剩餘 {getRemainingMovementSteps(room, player.uid, animationNow)} 步
                                  </div>
                                </div>
                              )}
                              <motion.div
                                layoutId={`player-token-${player.uid}`}
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{
                                  scale: isMoving ? 1.3 : isCurrentTurn ? 1.15 : 1,
                                  opacity: 1,
                                  y: isMoving ? -16 : 0
                                }}
                                transition={{
                                  type: "spring",
                                  stiffness: 400,
                                  damping: 28,
                                  mass: 0.8
                                }}
                                className={[
                                  'flex items-center justify-center overflow-hidden rounded-full border-2 bg-[linear-gradient(180deg,#8f6b48,#6f5237)] shadow-[0_12px_24px_-8px_rgba(86,58,32,0.9)]',
                                  isMoving ? 'h-16 w-16 border-[#ffefd6] ring-4 ring-[#ffefd6]/50' : 'h-14 w-14 border-[#fff8ee]',
                                  isCurrentTurn && !isMoving ? 'ring-2 ring-[#d8a66a]/70' : ''
                                ].join(' ')}
                                title={player.name}
                              >
                                {renderPlayerToken(player, isMoving)}
                              </motion.div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </main>
        </div>
      </div>

      {currentCard && (
          <div className="pointer-events-none fixed inset-0 z-[10020] flex items-center justify-center p-4 sm:p-8">
          <div className="pointer-events-auto flex items-center justify-center">
            <CardStage
              card={currentCard}
              isRevealed={isCardRevealed}
              drawerName={currentDrawerName}
              statusLabel={cardStatusLabel}
            />
          </div>
        </div>
      )}
    </div>
  );
};
