
import { Profession, Enterprise, Dream } from './types';

// Helper to create standard promotion structure based on images
const createPromotions = (titles: string[]) => [
  { rankTitle: titles[0], condition: '骰子 ≥ 2', bonus: 30000 },
  { rankTitle: titles[1], condition: '骰子 ≥ 3', bonus: 90000 },
  { rankTitle: titles[2], condition: '骰子 ≥ 4', bonus: 150000 },
  { rankTitle: titles[3], condition: '骰子 ≥ 5', bonus: 210000 },
];

export const BUBBLE_BURST_CODES = ['N002'];

export const STOCK_DATA: Record<string, Record<string, number>> = {
  'N001': { 'A10': 8500, 'A20': 7500, 'A30': 10500, 'A40': 12000, 'B50': 9500, 'B60': 11000, 'B70': 16000, 'B80': 20000 },
  'N003': { 'A10': 6500, 'A20': 6000, 'A30': 12000, 'A40': 9500, 'B50': 8000, 'B60': 9500, 'B70': 12500, 'B80': 16000 },
  'N005': { 'A10': 6000, 'A20': 6500, 'A30': 14000, 'A40': 8000, 'B50': 7500, 'B60': 9000, 'B70': 12000, 'B80': 14000 },
  'N007': { 'A10': 5500, 'A20': 6000, 'A30': 10000, 'A40': 7500, 'B50': 7000, 'B60': 8500, 'B70': 9500, 'B80': 13000 },
  'N009': { 'A10': 5500, 'A20': 4500, 'A30': 9500, 'A40': 7000, 'B50': 7000, 'B60': 7500, 'B70': 10000, 'B80': 12500 },
  'N010': { 'A10': 1500, 'A20': 1500, 'A30': 2500, 'A40': 2000, 'B50': 2200, 'B60': 1500, 'B70': 4000, 'B80': 3500 },
  'N011': { 'A10': 4500, 'A20': 4000, 'A30': 9000, 'A40': 6500, 'B50': 8500, 'B60': 7000, 'B70': 9500, 'B80': 11000 },
  'N012': { 'A10': 2000, 'A20': 1500, 'A30': 3000, 'A40': 2200, 'B50': 2500, 'B60': 2200, 'B70': 2800, 'B80': 3000 },
  'N013': { 'A10': 8000, 'A20': 4000, 'A30': 8500, 'A40': 6000, 'B50': 6500, 'B60': 6000, 'B70': 8000, 'B80': 10000 },
  'N014': { 'A10': 4000, 'A20': 5000, 'A30': 2500, 'A40': 3000, 'B50': 3500, 'B60': 3000, 'B70': 3200, 'B80': 4000 },
  'N015': { 'A10': 5500, 'A20': 5000, 'A30': 7500, 'A40': 6500, 'B50': 6000, 'B60': 8000, 'B70': 7500, 'B80': 9500 },
  'N016': { 'A10': 2000, 'A20': 2600, 'A30': 3000, 'A40': 3500, 'B50': 3000, 'B60': 2500, 'B70': 4000, 'B80': 5000 },
  'N017': { 'A10': 4500, 'A20': 5000, 'A30': 5000, 'A40': 6000, 'B50': 5500, 'B60': 7000, 'B70': 11500, 'B80': 9000 },
  'N018': { 'A10': 2200, 'A20': 2800, 'A30': 3000, 'A40': 3500, 'B50': 2500, 'B60': 4000, 'B70': 5000, 'B80': 6000 },
  'N019': { 'A10': 2300, 'A20': 3000, 'A30': 2000, 'A40': 3500, 'B50': 3000, 'B60': 4000, 'B70': 5500, 'B80': 6500 },
  'N020': { 'A10': 2500, 'A20': 3000, 'A30': 2200, 'A40': 4000, 'B50': 3500, 'B60': 4500, 'B70': 6000, 'B80': 7000 },
  'N021': { 'A10': 3500, 'A20': 4000, 'A30': 7000, 'A40': 5000, 'B50': 5000, 'B60': 5500, 'B70': 7500, 'B80': 8500 },
  'N022': { 'A10': 6500, 'A20': 6000, 'A30': 6000, 'A40': 4500, 'B50': 4000, 'B60': 5000, 'B70': 6000, 'B80': 8000 },
  'N023': { 'A10': 3500, 'A20': 3000, 'A30': 7000, 'A40': 5000, 'B50': 5000, 'B60': 5000, 'B70': 7000, 'B80': 8000 },
  'N024': { 'A10': 4500, 'A20': 6500, 'A30': 5500, 'A40': 6000, 'B50': 9000, 'B60': 3000, 'B70': 6000, 'B80': 8500 },
  'N025': { 'A10': 8500, 'A20': 4500, 'A30': 6000, 'A40': 7000, 'B50': 3000, 'B60': 7500, 'B70': 4000, 'B80': 8000 },
  'N026': { 'A10': 3000, 'A20': 2500, 'A30': 6500, 'A40': 8000, 'B50': 4000, 'B60': 4500, 'B70': 6000, 'B80': 9500 },
  'N002': { 'A10': 800, 'A20': 700, 'A30': 600, 'A40': 800, 'B50': 600, 'B60': 400, 'B70': 800, 'B80': 1000 },
  'N004': { 'A10': 800, 'A20': 700, 'A30': 1000, 'A40': 1500, 'B50': 1100, 'B60': 500, 'B70': 1500, 'B80': 2000 },
  'N006': { 'A10': 1000, 'A20': 1200, 'A30': 1000, 'A40': 1500, 'B50': 1200, 'B60': 800, 'B70': 2000, 'B80': 1500 },
  'N008': { 'A10': 1100, 'A20': 1700, 'A30': 2000, 'A40': 1200, 'B50': 1800, 'B60': 500, 'B70': 6000, 'B80': 2500 },
};

export const STOCK_SYMBOLS = [
  'A10', 'A20', 'A30', 'A40',
  'B50', 'B60', 'B70', 'B80'
];

export const STOCK_NAMES: Record<string, string> = {
  'A10': '禾田食品',
  'A20': '品新紡織',
  'A30': '高成建設',
  'A40': '遠順運輸',
  'B50': '青林出版',
  'B60': '樂禾娛樂',
  'B70': '安研生技',
  'B80': '冠城金融'
};

export const REAL_ESTATE_PRESETS: Record<string, {
  name: string;
  cost: number;
  downPayment: number;
  loanAmount: number;
  loanInterest: number;
  cashflow: number;
  happyPoints?: number;
}> = {
  'N029': { name: '單間小套房 (N029)', cost: 1100000, downPayment: 100000, loanAmount: 1000000, loanInterest: 5000, cashflow: 1500, happyPoints: 2 },
  'N030': { name: '單間小套房 (N030)', cost: 1050000, downPayment: 50000, loanAmount: 1000000, loanInterest: 5000, cashflow: 2000, happyPoints: 2 },
  'N031': { name: '單間小套房 (N031)', cost: 1000000, downPayment: 100000, loanAmount: 900000, loanInterest: 4500, cashflow: 1000, happyPoints: 2 },
  'N032': { name: '單間小套房 (N032)', cost: 1200000, downPayment: 200000, loanAmount: 1000000, loanInterest: 5000, cashflow: 5000, happyPoints: 2 },
  'N033': { name: '單間小套房 (N033)', cost: 1800000, downPayment: 300000, loanAmount: 1500000, loanInterest: 7500, cashflow: 2500, happyPoints: 2 },
  'N034': { name: '單間小套房 (N034)', cost: 1500000, downPayment: 200000, loanAmount: 1300000, loanInterest: 6500, cashflow: 500, happyPoints: 2 },
  'N035': { name: '兩房一廳住宅 (N035)', cost: 3000000, downPayment: 600000, loanAmount: 2400000, loanInterest: 12000, cashflow: 2000, happyPoints: 4 },
  'N036': { name: '兩房一廳住宅 (N036)', cost: 3600000, downPayment: 600000, loanAmount: 3000000, loanInterest: 15000, cashflow: 0, happyPoints: 4 },
  'N037': { name: '兩房一廳住宅 (N037)', cost: 2000000, downPayment: 200000, loanAmount: 1800000, loanInterest: 9000, cashflow: 3000, happyPoints: 4 },
  'N038': { name: '兩房一廳住宅 (N038)', cost: 2800000, downPayment: 300000, loanAmount: 2500000, loanInterest: 12500, cashflow: -2500, happyPoints: 4 },
  'N039': { name: '三房兩廳住宅 (N039)', cost: 4500000, downPayment: 500000, loanAmount: 4000000, loanInterest: 20000, cashflow: -2000, happyPoints: 6 },
  'N040': { name: '三房兩廳住宅 (N040)', cost: 3500000, downPayment: 300000, loanAmount: 3200000, loanInterest: 16000, cashflow: 4000, happyPoints: 6 },
  'N041': { name: '三房兩廳住宅 (N041)', cost: 4500000, downPayment: 500000, loanAmount: 4000000, loanInterest: 20000, cashflow: 2000, happyPoints: 6 },
  'N042': { name: '三房兩廳住宅 (N042)', cost: 5000000, downPayment: 500000, loanAmount: 4500000, loanInterest: 22500, cashflow: -2500, happyPoints: 6 },
  'N043': { name: '五房三廳豪華住宅 (N043)', cost: 15000000, downPayment: 5000000, loanAmount: 10000000, loanInterest: 50000, cashflow: 5000, happyPoints: 8 },
  'N044': { name: '五房三廳豪華住宅 (N044)', cost: 12000000, downPayment: 1200000, loanAmount: 10800000, loanInterest: 54000, cashflow: -4000, happyPoints: 8 },
  'N045': { name: '五房三廳豪華住宅 (N045)', cost: 16000000, downPayment: 5000000, loanAmount: 11000000, loanInterest: 55000, cashflow: 0, happyPoints: 8 },
  'N046': { name: '五房三廳豪華住宅 (N046)', cost: 9000000, downPayment: 1000000, loanAmount: 8000000, loanInterest: 40000, cashflow: 10000, happyPoints: 8 },
  'N047': { name: '小型店面 (N047)', cost: 1200000, downPayment: 120000, loanAmount: 1080000, loanInterest: 5400, cashflow: 9600 },
  'N048': { name: '小型店面 (N048)', cost: 1800000, downPayment: 180000, loanAmount: 1620000, loanInterest: 8100, cashflow: 11900 },
  'N049': { name: '小型店面 (N049)', cost: 1000000, downPayment: 80000, loanAmount: 920000, loanInterest: 4600, cashflow: 5400 },
  'N050': { name: '小型店面 (N050)', cost: 2000000, downPayment: 400000, loanAmount: 1600000, loanInterest: 8000, cashflow: 14000 },
  'N051': { name: '中型店面 (N051)', cost: 5000000, downPayment: 1000000, loanAmount: 4000000, loanInterest: 20000, cashflow: 20000 },
  'N052': { name: '中型店面 (N052)', cost: 6000000, downPayment: 3000000, loanAmount: 3000000, loanInterest: 15000, cashflow: 45000 },
  'N053': { name: '大型店面 (N053)', cost: 12000000, downPayment: 4000000, loanAmount: 8000000, loanInterest: 40000, cashflow: 110000 },
  'N054': { name: '大型店面 (N054)', cost: 16000000, downPayment: 6000000, loanAmount: 10000000, loanInterest: 50000, cashflow: 150000 },
};

export const BUSINESS_PRESETS: Record<string, {
  name: string;
  cost: number;
  loanAmount: number;
  loanInterest: number;
  income: number;
}> = {
  'N055': { name: '優質企業 (N055)', cost: 1000000, loanAmount: 800000, loanInterest: 4000, income: 24000 },
  'N056': { name: '兼職工作室 (N056)', cost: 503000, loanAmount: 500000, loanInterest: 2500, income: 0 },
  'N057': { name: '優質企業 (N057)', cost: 1200000, loanAmount: 960000, loanInterest: 4800, income: 28000 },
  'N058': { name: '兼職工作室 (N058)', cost: 605000, loanAmount: 600000, loanInterest: 3000, income: 0 },
  'N059': { name: '優質企業 (N059)', cost: 1500000, loanAmount: 1200000, loanInterest: 6000, income: 35000 },
  'N060': { name: '優質企業 (N060)', cost: 2000000, loanAmount: 1600000, loanInterest: 8000, income: 45000 },
};

export const REAL_ESTATE_SYMBOLS = Array.from({ length: 26 }, (_, i) => `N0${29 + i}`); // N029 ~ N054

export const REAL_ESTATE_TYPES: Record<string, { type: string; label: string }> = {
  'N029': { type: '1room', label: '單間小套房' },
  'N030': { type: '1room', label: '單間小套房' },
  'N031': { type: '1room', label: '單間小套房' },
  'N032': { type: '1room', label: '單間小套房' },
  'N033': { type: '1room', label: '單間小套房' },
  'N034': { type: '1room', label: '單間小套房' },
  'N035': { type: '2room', label: '兩房一廳住宅' },
  'N036': { type: '2room', label: '兩房一廳住宅' },
  'N037': { type: '2room', label: '兩房一廳住宅' },
  'N038': { type: '2room', label: '兩房一廳住宅' },
  'N039': { type: '3room', label: '三房兩廳住宅' },
  'N040': { type: '3room', label: '三房兩廳住宅' },
  'N041': { type: '3room', label: '三房兩廳住宅' },
  'N042': { type: '3room', label: '三房兩廳住宅' },
  'N043': { type: '5room', label: '五房三廳豪華住宅' },
  'N044': { type: '5room', label: '五房三廳豪華住宅' },
  'N045': { type: '5room', label: '五房三廳豪華住宅' },
  'N046': { type: '5room', label: '五房三廳豪華住宅' },
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
  { id: 'C04', name: '汽車4S店', cost: 60000000, income: 5000000, relatedProfessionId: 'pilot', relatedBonusPercent: 50, happyPoints: 10 },
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
  { id: 'D08', name: '捐救護汽車', cost: 50000000, happyPoints: 10 },
  { id: 'D09', name: '買私人別墅', cost: 40000000, happyPoints: 10 },
  { id: 'D10', name: '買豪華汽車', cost: 30000000, happyPoints: 10 },
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
