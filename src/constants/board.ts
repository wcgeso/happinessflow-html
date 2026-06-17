import { HAPPINESS_CARDS, NEWS_CARDS, OPPORTUNITY_CARDS } from './cards';
import { BoardDeckState, BoardSquare, BoardSquareType } from '../types';

const shuffle = <T,>(items: T[]): T[] => {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

const BANK_INTERVAL = 8;
const REPAIR_INDEX = 27;

const lerp = (start: number, end: number, steps: number, step: number) => {
  if (steps <= 1) return start;
  return start + ((end - start) * step) / (steps - 1);
};

const createBoardPath = () => {
  const top = Array.from({ length: 14 }, (_, index) => ({
    x: lerp(8, 92, 14, index),
    y: 11
  }));
  const right = Array.from({ length: 12 }, (_, index) => ({
    x: index % 2 === 0 ? 86 : 92,
    y: lerp(22, 76, 6, Math.floor(index / 2))
  }));
  const bottom = Array.from({ length: 14 }, (_, index) => ({
    x: lerp(92, 8, 14, index),
    y: 89
  }));
  const left = Array.from({ length: 12 }, (_, index) => ({
    x: index % 2 === 0 ? 14 : 8,
    y: lerp(78, 24, 6, Math.floor(index / 2))
  }));

  return [...top, ...right, ...bottom, ...left];
};

const alternatingTypes: BoardSquareType[] = ['happiness', 'news', 'opportunity'];
const alternatingLabels: Record<'happiness' | 'news' | 'opportunity', string> = {
  happiness: '幸福',
  news: '新聞',
  opportunity: '機運'
};
const alternatingTriggers: Record<'happiness' | 'news' | 'opportunity', string> = {
  happiness: '抽一張幸福卡',
  news: '抽一張新聞卡',
  opportunity: '抽一張機運卡'
};

const buildBoardSquares = (): BoardSquare[] => {
  const path = createBoardPath();
  let alternatingIndex = 0;

  return path.map((point, index) => {
    if (index === 0 || index === 39) {
      return {
        id: index === 0 ? 'school-top-left' : 'school-bottom-right',
        index,
        label: '學校',
        type: 'school',
        x: point.x,
        y: point.y,
        trigger: index === 0 ? '起點，可報名升等考試' : '可報名升等考試'
      };
    }

    if (index === 13 || index === 26) {
      return {
        id: index === 13 ? 'hospital-top-right' : 'hospital-bottom-left',
        index,
        label: '醫院',
        type: 'hospital',
        x: point.x,
        y: point.y,
        trigger: '醫藥費為骰點 x 1000，停一回合',
        pauseTurns: 1
      };
    }

    if ((index + 1) % BANK_INTERVAL === 0) {
      return {
        id: `bank-${index + 1}`,
        index,
        label: '銀行',
        type: 'bank',
        x: point.x,
        y: point.y,
        trigger: '經過時確認月結餘'
      };
    }

    if (index === REPAIR_INDEX) {
      return {
        id: 'repair-center-bottom',
        index,
        label: '維修廠',
        type: 'repair',
        x: point.x,
        y: point.y,
        trigger: '有汽車需支付保養費，踩到停一回合',
        pauseTurns: 1
      };
    }

    const type = alternatingTypes[alternatingIndex % alternatingTypes.length] as 'happiness' | 'news' | 'opportunity';
    alternatingIndex += 1;

    return {
      id: `${type}-${index + 1}`,
      index,
      label: alternatingLabels[type],
      type,
      x: point.x,
      y: point.y,
      trigger: alternatingTriggers[type]
    };
  });
};

export const BOARD_SQUARES: BoardSquare[] = buildBoardSquares();

export const createInitialDeckState = (): BoardDeckState => ({
  happiness: shuffle(HAPPINESS_CARDS.map(card => card.id)),
  opportunity: shuffle(OPPORTUNITY_CARDS.map(card => card.id)),
  news: shuffle(NEWS_CARDS.map(card => card.id)),
  usedHappiness: [],
  usedOpportunity: [],
  usedNews: []
});

export const getSquareByIndex = (index: number) => BOARD_SQUARES[index % BOARD_SQUARES.length];
