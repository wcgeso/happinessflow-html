
import { Profession, Enterprise, Dream } from './types';

// Helper to create standard promotion structure based on images
const createPromotions = (titles: string[]) => [
  { rankTitle: titles[0], condition: '骰子 ≥ 2', bonus: 30000 },
  { rankTitle: titles[1], condition: '骰子 ≥ 3', bonus: 90000 },
  { rankTitle: titles[2], condition: '骰子 ≥ 4', bonus: 150000 },
  { rankTitle: titles[3], condition: '骰子 ≥ 5', bonus: 210000 },
];

export const STOCK_SYMBOLS = [
  'A10', 'A20', 'A30', 'A40',
  'B50', 'B60', 'B70', 'B80'
];

export const STOCK_NAMES: Record<string, string> = {
  'A10': '蜜乳食品',
  'A20': '工蜂紡織',
  'A30': '皇家建設',
  'A40': '飛翅運輸',
  'B50': '綠草出版',
  'B60': '蜂寶樂園',
  'B70': '花粉製藥',
  'B80': '紫花銀行'
};

export const REAL_ESTATE_SYMBOLS = Array.from({ length: 26 }, (_, i) => `N0${29 + i}`); // N029 ~ N054

export const REAL_ESTATE_TYPES: Record<string, { type: string; label: string }> = {
  'N029': { type: '1room', label: '單間小套房' },
  'N030': { type: '1room', label: '單間小套房' },
  'N031': { type: '1room', label: '單間小套房' },
  'N032': { type: '1room', label: '單間小套房' },
  'N033': { type: '1room', label: '單間小套房' },
  'N034': { type: '1room', label: '單間小套房' },
  'N035': { type: '2room', label: '兩室一廳住宅' },
  'N036': { type: '2room', label: '兩室一廳住宅' },
  'N037': { type: '2room', label: '兩室一廳住宅' },
  'N038': { type: '2room', label: '兩室一廳住宅' },
  'N039': { type: '3room', label: '三室二廳住宅' },
  'N040': { type: '3room', label: '三室二廳住宅' },
  'N041': { type: '3room', label: '三室二廳住宅' },
  'N042': { type: '3room', label: '三室二廳住宅' },
  'N043': { type: '5room', label: '五室三廳豪華住宅' },
  'N044': { type: '5room', label: '五室三廳豪華住宅' },
  'N045': { type: '5room', label: '五室三廳豪華住宅' },
  'N046': { type: '5room', label: '五室三廳豪華住宅' },
  'N047': { type: 'store', label: '小型店面' },
  'N048': { type: 'store', label: '小型店面' },
  'N049': { type: 'store', label: '小型店面' },
  'N050': { type: 'store', label: '小型店面' },
  'N051': { type: 'store', label: '中型店面' },
  'N052': { type: 'store', label: '中型店面' },
  'N053': { type: 'store', label: '大型店面' },
  'N054': { type: 'store', label: '大型店面' },
};

export const BUSINESS_SYMBOLS = [
  'N055', 'N056', 'N057', 'N058', 'N059', 'N060'
];

export const ENTERPRISES: Enterprise[] = [
  { id: 'C01', name: '甜蜜蜜食品廠', cost: 50000000, income: 5000000, relatedProfessionId: 'honey_brewer', relatedBonusPercent: 10, happyPoints: 10 },
  { id: 'C02', name: '小黃蜂服飾場', cost: 50000000, income: 4500000, relatedProfessionId: 'fashion_designer', relatedBonusPercent: 10, happyPoints: 10 },
  { id: 'C03', name: '蜂巢建設公司', cost: 65000000, income: 5500000, relatedProfessionId: 'nest_builder', relatedBonusPercent: 20, happyPoints: 10 },
  { id: 'C04', name: '飛行器4S店', cost: 60000000, income: 5000000, relatedProfessionId: 'pilot', relatedBonusPercent: 50, happyPoints: 10 },
  { id: 'C05', name: '蜂寶寶育兒園', cost: 55000000, income: 6000000, relatedProfessionId: 'teacher', relatedBonusPercent: 20, happyPoints: 10 },
  { id: 'C06', name: '皇家歌劇院', cost: 70000000, income: 6000000, relatedProfessionId: 'artist', relatedBonusPercent: 40, happyPoints: 10 },
  { id: 'C07', name: '蜂皇乳生技公司', cost: 65000000, income: 5500000, relatedProfessionId: 'doctor', relatedBonusPercent: 50, happyPoints: 10 },
  { id: 'C08', name: '蜜多多金控公司', cost: 80000000, income: 6500000, relatedProfessionId: 'accountant', relatedBonusPercent: 30, happyPoints: 10 },
  { id: 'C09', name: '兵蜂科技公司', cost: 65000000, income: 5500000, relatedProfessionId: 'technician', relatedBonusPercent: 30, happyPoints: 10 },
  { id: 'C10', name: '蜂愛來購物商城', cost: 50000000, income: 4000000, relatedProfessionId: 'clerk', relatedBonusPercent: 10, happyPoints: 10 },
];

export const DREAMS: Dream[] = [
  { id: 'D01', name: '對抗溫室效應', description: '為地球種一片森林', cost: 60000000, happyPoints: 10 },
  { id: 'D02', name: '環遊世界八十天', cost: 30000000, happyPoints: 10 },
  { id: 'D03', name: '蓋兒童慈善樂園', cost: 100000000, happyPoints: 10 },
  { id: 'D04', name: '成立ESG基金會', description: '為地球永續而努力', cost: 50000000, happyPoints: 10 },
  { id: 'D05', name: '蓋歷史博物館', cost: 60000000, happyPoints: 10 },
  { id: 'D06', name: '蓋蜂皇巨大雕像', cost: 40000000, happyPoints: 10 },
  { id: 'D07', name: '建安養照護中心', cost: 70000000, happyPoints: 10 },
  { id: 'D08', name: '捐救護飛行器', cost: 50000000, happyPoints: 10 },
  { id: 'D09', name: '買私人別墅', cost: 40000000, happyPoints: 10 },
  { id: 'D10', name: '買豪華飛行器', cost: 30000000, happyPoints: 10 },
];

export const PROFESSIONS: Profession[] = [
  {
    id: 'nest_builder',
    title: '築巢師系列',
    initialRank: '助理築巢師',
    salary: 30000,
    savings: 20000,
    expenses: {
      tax: 1500,
      basicLiving: 10000,
      transportEdu: 6500,
      otherMedicalChild: 4500,
    },
    mortgageTotal: 0,
    businessLoanTotal: 0,
    creditLoanTotal: 0,
    promotions: createPromotions(['築巢師', '資深築巢師', '蜂巢建築師', '總建築師'])
  },
  {
    id: 'clerk',
    title: '店員系列',
    initialRank: '實習店員',
    salary: 30000,
    savings: 20000,
    expenses: {
      tax: 1500,
      basicLiving: 13000,
      transportEdu: 6000,
      otherMedicalChild: 3500,
    },
    mortgageTotal: 0,
    businessLoanTotal: 0,
    creditLoanTotal: 0,
    promotions: createPromotions(['店員', '業務主任', '業務經理', '店長'])
  },
  {
    id: 'accountant',
    title: '會計師系列',
    initialRank: '會計助理',
    salary: 30000,
    savings: 20000,
    expenses: {
      tax: 1500,
      basicLiving: 13000,
      transportEdu: 5500,
      otherMedicalChild: 3500,
    },
    mortgageTotal: 0,
    businessLoanTotal: 0,
    creditLoanTotal: 0,
    promotions: createPromotions(['會計師', '資深會計師', '會計經理', '合夥會計師'])
  },
  {
    id: 'honey_brewer',
    title: '釀蜜師系列',
    initialRank: '釀蜜師學徒',
    salary: 30000,
    savings: 20000,
    expenses: {
      tax: 1500,
      basicLiving: 10500,
      transportEdu: 6500,
      otherMedicalChild: 3500,
    },
    mortgageTotal: 0,
    businessLoanTotal: 0,
    creditLoanTotal: 0,
    promotions: createPromotions(['釀蜜師', '高級釀蜜師', '特級釀蜜師', '釀蜜大師'])
  },
  {
    id: 'teacher',
    title: '教師系列',
    initialRank: '實習教師',
    salary: 30000,
    savings: 20000,
    expenses: {
      tax: 1500,
      basicLiving: 11500,
      transportEdu: 6000,
      otherMedicalChild: 3500,
    },
    mortgageTotal: 0,
    businessLoanTotal: 0,
    creditLoanTotal: 0,
    promotions: createPromotions(['教師', '教學組長', '學務主任', '校長'])
  },
  {
    id: 'technician',
    title: '技師系列',
    initialRank: '技師學徒',
    salary: 30000,
    savings: 20000,
    expenses: {
      tax: 1500,
      basicLiving: 12000,
      transportEdu: 6000,
      otherMedicalChild: 4000,
    },
    mortgageTotal: 0,
    businessLoanTotal: 0,
    creditLoanTotal: 0,
    promotions: createPromotions(['技師', '工程師', '資深工程師', '總工程師'])
  },
  {
    id: 'doctor',
    title: '醫師系列',
    initialRank: '實習醫師',
    salary: 30000,
    savings: 20000,
    expenses: {
      tax: 1500,
      basicLiving: 11000,
      transportEdu: 7000,
      otherMedicalChild: 2000,
    },
    mortgageTotal: 0,
    businessLoanTotal: 0,
    creditLoanTotal: 0,
    promotions: createPromotions(['住院醫師', '主治醫師', '主任醫師', '院長'])
  },
  {
    id: 'artist',
    title: '表演練習生系列',
    initialRank: '表演練習生',
    salary: 30000,
    savings: 20000,
    expenses: {
      tax: 1500,
      basicLiving: 12000,
      transportEdu: 8000,
      otherMedicalChild: 3500,
    },
    mortgageTotal: 0,
    businessLoanTotal: 0,
    creditLoanTotal: 0,
    promotions: createPromotions(['街頭藝人', '舞台工作者', '藝術創作者', '藝術大師'])
  },
  {
    id: 'pilot',
    title: '飛行員系列',
    initialRank: '見習飛行員',
    salary: 30000,
    savings: 20000,
    expenses: {
      tax: 1500,
      basicLiving: 14000,
      transportEdu: 4500,
      otherMedicalChild: 3500,
    },
    mortgageTotal: 0,
    businessLoanTotal: 0,
    creditLoanTotal: 0,
    promotions: createPromotions(['飛行員', '資深飛行員', '飛行教官', '飛行大師'])
  },
  {
    id: 'fashion_designer',
    title: '裁縫師系列',
    initialRank: '裁縫學徒',
    salary: 30000,
    savings: 20000,
    expenses: {
      tax: 1500,
      basicLiving: 12000,
      transportEdu: 6500,
      otherMedicalChild: 3500,
    },
    mortgageTotal: 0,
    businessLoanTotal: 0,
    creditLoanTotal: 0,
    promotions: createPromotions(['裁縫師', '服裝設計師', '主設計師', '設計總監'])
  },
];
