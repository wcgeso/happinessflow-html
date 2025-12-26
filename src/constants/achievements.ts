import { Achievement } from '../types';

export const ACHIEVEMENTS: Achievement[] = [
  // 幸福指數相關
  {
    id: 'happy_30',
    title: '幸福初體驗',
    description: '第一次達成幸福指數 30 分',
    category: 'happiness',
    icon: 'Heart'
  },
  {
    id: 'happy_60',
    title: '幸福漸入佳境',
    description: '達成幸福指數 60 分',
    category: 'happiness',
    icon: 'Heart'
  },
  {
    id: 'happy_80',
    title: '幸福滿溢',
    description: '達成幸福指數 80 分',
    category: 'happiness',
    icon: 'Heart'
  },
  {
    id: 'happy_100',
    title: '幸福大滿貫',
    description: '達成幸福指數 100 分',
    category: 'happiness',
    icon: 'Heart'
  },

  // 資產與事件相關
  {
    id: 'first_aircraft',
    title: '一飛衝天',
    description: '第一次獲得飛行器',
    category: 'asset',
    icon: 'Plane'
  },
  {
    id: 'repair_aircraft',
    title: '飛行器維修員',
    description: '第一次維修飛行器',
    category: 'asset',
    icon: 'Settings'
  },
  {
    id: 'first_hospital',
    title: '健康警訊',
    description: '解鎖第一次住院',
    category: 'event',
    icon: 'PlusSquare'
  },
  {
    id: 'hospital_5',
    title: '醫院常客',
    description: '住院累積滿 5 次',
    category: 'event',
    icon: 'PlusSquare'
  },

  // 夢想相關
  {
    id: 'first_dream',
    title: '夢想起飛',
    description: '第一次完成夢想',
    category: 'dream',
    icon: 'Cloud'
  },
  {
    id: 'dreams_3',
    title: '夢想收藏家 (初級)',
    description: '累積完成 3 項夢想',
    category: 'dream',
    icon: 'Cloud'
  },
  {
    id: 'dreams_6',
    title: '夢想收藏家 (中級)',
    description: '累積完成 6 項夢想',
    category: 'dream',
    icon: 'Cloud'
  },
  {
    id: 'dreams_10',
    title: '夢想收藏家 (高級)',
    description: '累積完成 10 項夢想',
    category: 'dream',
    icon: 'Cloud'
  },

  // 事業相關
  {
    id: 'first_career',
    title: '事業有成',
    description: '第一次完成事業',
    category: 'career',
    icon: 'Briefcase'
  },
  {
    id: 'careers_3',
    title: '事業大亨 (初級)',
    description: '累積完成 3 項事業',
    category: 'career',
    icon: 'Briefcase'
  },
  {
    id: 'careers_6',
    title: '事業大亨 (中級)',
    description: '累積完成 6 項事業',
    category: 'career',
    icon: 'Briefcase'
  },
  {
    id: 'careers_10',
    title: '事業大亨 (高級)',
    description: '累積完成 10 項事業',
    category: 'career',
    icon: 'Briefcase'
  },

  // 職業等級相關
  {
    id: 'rank_3',
    title: '三星達人',
    description: '達成三星職業等級',
    category: 'gameplay',
    icon: 'Star'
  },
  {
    id: 'rank_5',
    title: '五星傳奇',
    description: '達成五星職業等級',
    category: 'gameplay',
    icon: 'Trophy'
  },

  // 遊玩場次相關
  {
    id: 'first_play',
    title: '首場紀念',
    description: '第一次完成遊戲',
    category: 'gameplay',
    icon: 'Play'
  },
  {
    id: 'plays_5',
    title: '遊戲愛好者',
    description: '累積遊玩滿 5 場',
    category: 'gameplay',
    icon: 'Play'
  },
  {
    id: 'plays_10',
    title: '資深玩家',
    description: '累積遊玩滿 10 場',
    category: 'gameplay',
    icon: 'Play'
  },
  {
    id: 'plays_20',
    title: '幸福大師',
    description: '累積遊玩滿 20 場',
    category: 'gameplay',
    icon: 'Play'
  },

  // 職業蒐集相關
  {
    id: 'professions_3',
    title: '斜槓青年',
    description: '累積體驗過 3 種職業',
    category: 'gameplay',
    icon: 'Users'
  },
  {
    id: 'professions_6',
    title: '職業通才',
    description: '累積體驗過 6 種職業',
    category: 'gameplay',
    icon: 'Users'
  },
  {
    id: 'professions_10',
    title: '全能專家',
    description: '累積體驗過 10 種職業',
    category: 'gameplay',
    icon: 'Users'
  },

  // 財務階段相關
  {
    id: 'finance_safe',
    title: '財務安全',
    description: '第一次達到財務安全階段',
    category: 'finance',
    icon: 'ShieldCheck'
  },
  {
    id: 'finance_rich',
    title: '財務充裕',
    description: '第一次達到財務充裕階段',
    category: 'finance',
    icon: 'Gem'
  },
  {
    id: 'finance_free',
    title: '財務自由',
    description: '第一次達到財務自由階段',
    category: 'finance',
    icon: 'Zap'
  },
  // 新增建議成就
  {
    id: 'marriage',
    title: '步入禮堂',
    description: '第一次在遊戲中結婚',
    category: 'event',
    icon: 'Heart'
  },
  {
    id: 'first_child',
    title: '新生命到來',
    description: '第一次獲得孩子',
    category: 'event',
    icon: 'Baby'
  },
  {
    id: 'first_house',
    title: '首購族',
    description: '第一次購入房產',
    category: 'asset',
    icon: 'Home'
  },
  {
    id: 'luxury_house',
    title: '豪宅主人',
    description: '擁有價值超過 1000 萬的房產',
    category: 'asset',
    icon: 'Building'
  },
  {
    id: 'debt_free',
    title: '無債一身輕',
    description: '償還所有貸款',
    category: 'finance',
    icon: 'CheckCircle'
  },
  {
    id: 'passive_income_50k',
    title: '被動收入達人',
    description: '月被動收入超過 5 萬',
    category: 'finance',
    icon: 'TrendingUp'
  },
  {
    id: 'five_blessings',
    title: '五子登科',
    description: '同時擁有房產、事業、孩子、飛行器與財務自由',
    category: 'gameplay',
    icon: 'Trophy'
  }
];
