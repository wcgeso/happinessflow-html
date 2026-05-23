// ============================================================
// 蜂富人生 Card Database
// ============================================================

// ===== HAPPINESS CARDS (幸福卡) =====

export type HappinessCardCategory =
  | '幸福回憶'
  | '家庭重要歷程'
  | '追求家庭幸福'
  | '良好人際關係'
  | '幸福的社會';

export interface HappinessCard {
  id: string;
  title: string;
  category: HappinessCardCategory;
  happinessPoints: number;
  cashCost?: number;                // one-time payment
  monthlyExpenseIncrease?: number;  // permanent monthly expense increase
  childrenIncrease?: number;        // adds to children count
  requiresStorySharing?: boolean;   // player must share a personal story
  otherPlayersCanJoin?: boolean;    // other players roll dice to join
  joinDiceMin?: number;             // min dice roll for others to join
}

export const HAPPINESS_CARDS: HappinessCard[] = [
  // ─── 我的幸福回憶（H001–H010）───
  // Effect: share a personal story → +2 happiness, no cost
  { id: 'H001', title: '童年的美好時光', category: '幸福回憶', happinessPoints: 2, requiresStorySharing: true },
  { id: 'H002', title: '第一次騎腳踏車', category: '幸福回憶', happinessPoints: 2, requiresStorySharing: true },
  { id: 'H003', title: '第一份工作', category: '幸福回憶', happinessPoints: 2, requiresStorySharing: true },
  { id: 'H004', title: '第一次出國旅遊', category: '幸福回憶', happinessPoints: 2, requiresStorySharing: true },
  { id: 'H005', title: '畢業典禮', category: '幸福回憶', happinessPoints: 2, requiresStorySharing: true },
  { id: 'H006', title: '第一次戀愛', category: '幸福回憶', happinessPoints: 2, requiresStorySharing: true },
  { id: 'H007', title: '第一次學會游泳', category: '幸福回憶', happinessPoints: 2, requiresStorySharing: true },
  { id: 'H008', title: '與朋友的難忘時光', category: '幸福回憶', happinessPoints: 2, requiresStorySharing: true },
  { id: 'H009', title: '親子間的溫馨時刻', category: '幸福回憶', happinessPoints: 2, requiresStorySharing: true },
  { id: 'H010', title: '幫助他人的感動', category: '幸福回憶', happinessPoints: 2, requiresStorySharing: true },

  // ─── 幸福家庭的重要歷程（H011–H020）───
  // Multi-step series; other players roll ≥4 to join each step
  { id: 'H011', title: '約會', category: '家庭重要歷程', happinessPoints: 2, cashCost: 3000, otherPlayersCanJoin: true, joinDiceMin: 4 },
  { id: 'H012', title: '求婚', category: '家庭重要歷程', happinessPoints: 2, cashCost: 5000, otherPlayersCanJoin: true, joinDiceMin: 4 },
  { id: 'H013', title: '婚禮', category: '家庭重要歷程', happinessPoints: 2, cashCost: 100000, otherPlayersCanJoin: true, joinDiceMin: 4 },
  { id: 'H014', title: '孩子出生（第1個）', category: '家庭重要歷程', happinessPoints: 2, monthlyExpenseIncrease: 10000, childrenIncrease: 1, otherPlayersCanJoin: true, joinDiceMin: 4 },
  { id: 'H015', title: '孩子出生（第2個）', category: '家庭重要歷程', happinessPoints: 2, monthlyExpenseIncrease: 10000, childrenIncrease: 1, otherPlayersCanJoin: true, joinDiceMin: 4 },
  // TODO: verify exact titles and costs for H016–H020
  { id: 'H016', title: '家庭里程（H016）', category: '家庭重要歷程', happinessPoints: 2, otherPlayersCanJoin: true, joinDiceMin: 4 },
  { id: 'H017', title: '家庭里程（H017）', category: '家庭重要歷程', happinessPoints: 2, otherPlayersCanJoin: true, joinDiceMin: 4 },
  { id: 'H018', title: '家庭里程（H018）', category: '家庭重要歷程', happinessPoints: 2, otherPlayersCanJoin: true, joinDiceMin: 4 },
  { id: 'H019', title: '家庭里程（H019）', category: '家庭重要歷程', happinessPoints: 2, otherPlayersCanJoin: true, joinDiceMin: 4 },
  { id: 'H020', title: '家庭里程（H020）', category: '家庭重要歷程', happinessPoints: 2, otherPlayersCanJoin: true, joinDiceMin: 4 },

  // ─── 追求家庭的幸福（H021–H030）───
  // One-time cost, +2 happiness; TODO: verify individual costs (range: 6,000–50,000H)
  { id: 'H021', title: '家庭聚餐', category: '追求家庭幸福', happinessPoints: 2, cashCost: 6000 },
  { id: 'H022', title: '生日宴', category: '追求家庭幸福', happinessPoints: 2, cashCost: 10000 },
  { id: 'H023', title: '健康檢查', category: '追求家庭幸福', happinessPoints: 2, cashCost: 8000 },
  { id: 'H024', title: '家族旅遊', category: '追求家庭幸福', happinessPoints: 2, cashCost: 30000 },
  { id: 'H025', title: '添購家電', category: '追求家庭幸福', happinessPoints: 2, cashCost: 15000 },
  { id: 'H026', title: '家庭運動', category: '追求家庭幸福', happinessPoints: 2, cashCost: 6000 },
  { id: 'H027', title: '家庭電影之夜', category: '追求家庭幸福', happinessPoints: 2, cashCost: 6000 },
  { id: 'H028', title: '親子讀書', category: '追求家庭幸福', happinessPoints: 2, cashCost: 6000 },
  { id: 'H029', title: '節慶活動', category: '追求家庭幸福', happinessPoints: 2, cashCost: 10000 },
  { id: 'H030', title: '家庭志工', category: '追求家庭幸福', happinessPoints: 2, cashCost: 6000 },

  // ─── 良好的人際關係（H031–H038）───
  // Monthly expense increase, +2 happiness; TODO: verify individual amounts (range: 2,000–3,000H/month)
  { id: 'H031', title: '朋友聚會', category: '良好人際關係', happinessPoints: 2, monthlyExpenseIncrease: 2000 },
  { id: 'H032', title: '婚禮祝賀', category: '良好人際關係', happinessPoints: 2, monthlyExpenseIncrease: 2000 },
  { id: 'H033', title: '讀書會', category: '良好人際關係', happinessPoints: 2, monthlyExpenseIncrease: 2000 },
  { id: 'H034', title: '出國旅遊', category: '良好人際關係', happinessPoints: 2, monthlyExpenseIncrease: 3000 },
  { id: 'H035', title: '服飾儀容', category: '良好人際關係', happinessPoints: 2, monthlyExpenseIncrease: 2000 },
  // TODO: verify exact titles for H036–H038
  { id: 'H036', title: '社交活動（H036）', category: '良好人際關係', happinessPoints: 2, monthlyExpenseIncrease: 2000 },
  { id: 'H037', title: '社交活動（H037）', category: '良好人際關係', happinessPoints: 2, monthlyExpenseIncrease: 2000 },
  { id: 'H038', title: '社交活動（H038）', category: '良好人際關係', happinessPoints: 2, monthlyExpenseIncrease: 3000 },

  // ─── 幸福的社會（H039–H042）───
  // Monthly expense +2,000H, +2 happiness each
  { id: 'H039', title: '擔任義工', category: '幸福的社會', happinessPoints: 2, monthlyExpenseIncrease: 2000 },
  { id: 'H040', title: '敬老活動', category: '幸福的社會', happinessPoints: 2, monthlyExpenseIncrease: 2000 },
  { id: 'H041', title: '急難救助', category: '幸福的社會', happinessPoints: 2, monthlyExpenseIncrease: 2000 },
  { id: 'H042', title: '扶幼濟貧', category: '幸福的社會', happinessPoints: 2, monthlyExpenseIncrease: 2000 },

  // ─── 幸福家庭重要歷程（H043–H046）───
  // TODO: verify exact titles and costs (same series as H011–H020)
  { id: 'H043', title: '家庭里程（H043）', category: '家庭重要歷程', happinessPoints: 2, otherPlayersCanJoin: true, joinDiceMin: 4 },
  { id: 'H044', title: '家庭里程（H044）', category: '家庭重要歷程', happinessPoints: 2, otherPlayersCanJoin: true, joinDiceMin: 4 },
  { id: 'H045', title: '家庭里程（H045）', category: '家庭重要歷程', happinessPoints: 2, otherPlayersCanJoin: true, joinDiceMin: 4 },
  { id: 'H046', title: '家庭里程（H046）', category: '家庭重要歷程', happinessPoints: 2, otherPlayersCanJoin: true, joinDiceMin: 4 },
];

// ===== OPPORTUNITY CARDS (機會卡) =====

export type OpportunityCardType =
  | 'ability_profession'
  | 'ability_stock'
  | 'ability_realestate'
  | 'purchase_1room'
  | 'purchase_any_house'
  | 'purchase_store'
  | 'purchase_startup'
  | 'enterprise_acquisition'
  | 'medical'
  | 'aircraft_damage'
  | 'property_repair'
  | 'theft'
  | 'inflation'
  | 'penalty'
  | 'reward';

export interface OpportunityCard {
  id: string;
  title: string;
  type: OpportunityCardType;
  description: string;
  // School/ability cards
  schoolFee?: number;
  diceRequirement?: number;
  abilityEffect?: string;
  // Purchase/acquisition cards
  purchasePrice?: number;        // fixed buyout price
  purchasePercent?: number;      // % of property's total price
  acquisitionMultiple?: number;  // monthly income × multiplier
  // Direct cash effects
  cashLoss?: number;
  cashGain?: number;
  monthlyExpenseChange?: number; // positive = increase, negative = decrease
  happinessLoss?: number;
  // Special rules
  goToSquare?: 'hospital' | 'school' | '4s_shop';
  missRounds?: number;
  noBankPassThisRound?: boolean;
  insurancePays?: number;
  affectsAllPlayers?: boolean;
  drawCard?: 'happiness' | 'news';
  requiresStorySharing?: boolean;
}

export const OPPORTUNITY_CARDS: OpportunityCard[] = [
  // ─── 增強職業能力（C001–C004）───
  // Optional: pay 5,000H → go to school, miss 1 round (no bank pass); roll ≥2 → job +1 level
  { id: 'C001', title: '增強職業能力', type: 'ability_profession', description: '增強職業能力。可選擇接受或不接受。接受：學費5,000H，走到學校格停費一輪，擲骰≥2則職業等級晉升一級。', schoolFee: 5000, diceRequirement: 2, abilityEffect: 'profession_level_up', goToSquare: 'school', missRounds: 1, noBankPassThisRound: true },
  { id: 'C002', title: '增強職業能力', type: 'ability_profession', description: '增強職業能力。可選擇接受或不接受。接受：學費5,000H，走到學校格停費一輪，擲骰≥2則職業等級晉升一級。', schoolFee: 5000, diceRequirement: 2, abilityEffect: 'profession_level_up', goToSquare: 'school', missRounds: 1, noBankPassThisRound: true },
  { id: 'C003', title: '增強職業能力', type: 'ability_profession', description: '增強職業能力。可選擇接受或不接受。接受：學費5,000H，走到學校格停費一輪，擲骰≥2則職業等級晉升一級。', schoolFee: 5000, diceRequirement: 2, abilityEffect: 'profession_level_up', goToSquare: 'school', missRounds: 1, noBankPassThisRound: true },
  { id: 'C004', title: '增強職業能力', type: 'ability_profession', description: '增強職業能力。可選擇接受或不接受。接受：學費5,000H，走到學校格停費一輪，擲骰≥2則職業等級晉升一級。', schoolFee: 5000, diceRequirement: 2, abilityEffect: 'profession_level_up', goToSquare: 'school', missRounds: 1, noBankPassThisRound: true },

  // ─── 投資股票的能力（C005–C006）───
  // Optional: pay 10,000H → school, miss 1 round; roll ≥4 → all stock shares ×2
  { id: 'C005', title: '投資股票的能力', type: 'ability_stock', description: '投資股票的能力。可選擇接受或不接受。接受：學費10,000H，走到學校格停費一輪，擲骰≥4則持有股票股數全部翻倍。', schoolFee: 10000, diceRequirement: 4, abilityEffect: 'stock_double', goToSquare: 'school', missRounds: 1, noBankPassThisRound: true },
  { id: 'C006', title: '投資股票的能力', type: 'ability_stock', description: '投資股票的能力。可選擇接受或不接受。接受：學費10,000H，走到學校格停費一輪，擲骰≥4則持有股票股數全部翻倍。', schoolFee: 10000, diceRequirement: 4, abilityEffect: 'stock_double', goToSquare: 'school', missRounds: 1, noBankPassThisRound: true },

  // ─── 投資不動產的能力（C007–C008）───
  // C007: 5,000H; C008: 10,000H; roll ≥4 → all rental properties rent +10,000H
  { id: 'C007', title: '投資不動產的能力', type: 'ability_realestate', description: '投資不動產的能力。可選擇接受或不接受。接受：學費5,000H，走到學校格停費一輪，擲骰≥4則所有出租不動產房租各+10,000H。', schoolFee: 5000, diceRequirement: 4, abilityEffect: 'rent_plus_10000', goToSquare: 'school', missRounds: 1, noBankPassThisRound: true },
  { id: 'C008', title: '投資不動產的能力', type: 'ability_realestate', description: '投資不動產的能力。可選擇接受或不接受。接受：學費10,000H，走到學校格停費一輪，擲骰≥4則所有出租不動產房租各+10,000H。', schoolFee: 10000, diceRequirement: 4, abilityEffect: 'rent_plus_10000', goToSquare: 'school', missRounds: 1, noBankPassThisRound: true },

  // ─── 求購單間小套房（C009–C012）───
  // Buyer wants to purchase 1-room suite; seller receives fixed price
  { id: 'C009', title: '求購單間小套房', type: 'purchase_1room', description: '有買家願意以3,000,000H收購單間小套房一間。持有者可決定是否出售。', purchasePrice: 3000000 },
  { id: 'C010', title: '求購單間小套房', type: 'purchase_1room', description: '有買家願意以3,500,000H收購單間小套房一間。持有者可決定是否出售。', purchasePrice: 3500000 },
  { id: 'C011', title: '求購單間小套房', type: 'purchase_1room', description: '有買家願意以4,500,000H收購單間小套房一間。持有者可決定是否出售。', purchasePrice: 4500000 },
  { id: 'C012', title: '求購單間小套房', type: 'purchase_1room', description: '有買家願意以4,000,000H收購單間小套房一間。持有者可決定是否出售。', purchasePrice: 4000000 },

  // ─── 求購各類型住宅（C013–C016）───
  // % of property total price; seller decides
  { id: 'C013', title: '求購各類型住宅', type: 'purchase_any_house', description: '有買家願意以房屋總價50%收購各類型住宅一間。持有者可決定是否出售。', purchasePercent: 50 },
  { id: 'C014', title: '求購各類型住宅', type: 'purchase_any_house', description: '有買家願意以房屋總價60%收購各類型住宅一間。持有者可決定是否出售。', purchasePercent: 60 },
  { id: 'C015', title: '求購各類型住宅', type: 'purchase_any_house', description: '有買家願意以房屋總價40%收購各類型住宅一間。持有者可決定是否出售。', purchasePercent: 40 },
  { id: 'C016', title: '求購各類型住宅', type: 'purchase_any_house', description: '有買家願意以房屋總價70%收購各類型住宅一間。持有者可決定是否出售。', purchasePercent: 70 },

  // ─── 求購兩室一廳/三室兩廳（C017–C022）───
  { id: 'C017', title: '首次購屋優惠求購', type: 'purchase_any_house', description: '首次購屋優惠。買家以房屋總價30%收購兩室一廳或三室兩廳住宅一間。', purchasePercent: 30 },
  { id: 'C018', title: '吸引人才政策求購', type: 'purchase_any_house', description: '吸引人才政策。買家以房屋總價50%收購兩室一廳或三室兩廳住宅一間。', purchasePercent: 50 },
  { id: 'C019', title: '首次購屋優惠求購', type: 'purchase_any_house', description: '首次購屋優惠。買家以房屋總價35%收購兩室一廳或三室兩廳住宅一間。', purchasePercent: 35 },
  { id: 'C020', title: '吸引人才政策求購', type: 'purchase_any_house', description: '吸引人才政策。買家以房屋總價60%收購兩室一廳或三室兩廳住宅一間。', purchasePercent: 60 },
  { id: 'C021', title: '首次購屋優惠求購', type: 'purchase_any_house', description: '首次購屋優惠。買家以房屋總價40%收購兩室一廳或三室兩廳住宅一間。', purchasePercent: 40 },
  { id: 'C022', title: '吸引人才政策求購', type: 'purchase_any_house', description: '吸引人才政策。買家以房屋總價45%收購兩室一廳或三室兩廳住宅一間。', purchasePercent: 45 },

  // ─── 求購各類型店面（C023–C026）───
  { id: 'C023', title: '求購各類型店面', type: 'purchase_store', description: '有買家願意以店面總價50%收購各類型店面一間。持有者可決定是否出售。', purchasePercent: 50 },
  { id: 'C024', title: '求購各類型店面', type: 'purchase_store', description: '有買家願意以店面總價55%收購各類型店面一間。持有者可決定是否出售。', purchasePercent: 55 },
  { id: 'C025', title: '求購各類型店面', type: 'purchase_store', description: '有買家願意以店面總價60%收購各類型店面一間。持有者可決定是否出售。', purchasePercent: 60 },
  { id: 'C026', title: '求購各類型店面', type: 'purchase_store', description: '有買家願意以店面總價45%收購各類型店面一間。持有者可決定是否出售。', purchasePercent: 45 },

  // ─── 收購獨特的創業點子（C027–C028）───
  // Only for 兼職工作室 (not yet upgraded to 小型企業)
  { id: 'C027', title: '收購獨特的創業點子', type: 'purchase_startup', description: '有人看上你的創業點子！以3,000,000H收購兼職工作室（不含已升為小型企業者）。持有者可決定是否出售。', purchasePrice: 3000000 },
  { id: 'C028', title: '收購獨特的創業點子', type: 'purchase_startup', description: '有人看上你的創業點子！以5,000,000H收購兼職工作室（不含已升為小型企業者）。持有者可決定是否出售。', purchasePrice: 5000000 },

  // ─── 企業併購（C029–C034）───
  // All players may sell any enterprise; price = monthly income × multiplier (minus any loan)
  { id: 'C029', title: '企業併購', type: 'enterprise_acquisition', description: '企業併購！所有玩家可決定是否出售旗下企業。收購價 = 企業月收益 × 60倍（有貸款者先扣貸款）。', acquisitionMultiple: 60 },
  { id: 'C030', title: '企業併購', type: 'enterprise_acquisition', description: '企業併購！所有玩家可決定是否出售旗下企業。收購價 = 企業月收益 × 50倍（有貸款者先扣貸款）。', acquisitionMultiple: 50 },
  { id: 'C031', title: '企業併購', type: 'enterprise_acquisition', description: '企業併購！所有玩家可決定是否出售旗下企業。收購價 = 企業月收益 × 60倍（有貸款者先扣貸款）。', acquisitionMultiple: 60 },
  { id: 'C032', title: '企業併購', type: 'enterprise_acquisition', description: '企業併購！所有玩家可決定是否出售旗下企業。收購價 = 企業月收益 × 50倍（有貸款者先扣貸款）。', acquisitionMultiple: 50 },
  { id: 'C033', title: '企業併購', type: 'enterprise_acquisition', description: '企業併購！所有玩家可決定是否出售旗下企業。收購價 = 企業月收益 × 60倍（有貸款者先扣貸款）。', acquisitionMultiple: 60 },
  { id: 'C034', title: '企業併購', type: 'enterprise_acquisition', description: '企業併購！所有玩家可決定是否出售旗下企業。收購價 = 企業月收益 × 70倍（有貸款者先扣貸款）。', acquisitionMultiple: 70 },

  // ─── 天有不測風雲：醫療類（C035–C037）───
  // Go to hospital, miss 1 round; medical insurance pays 50,000H
  { id: 'C035', title: '爆發蜂流感', type: 'medical', description: '爆發蜂流感！走到醫院格，停費一輪。醫療費20,000H。有醫療保險可領賠50,000H。', cashLoss: 20000, goToSquare: 'hospital', missRounds: 1, insurancePays: 50000 },
  { id: 'C036', title: '食物中毒', type: 'medical', description: '食物中毒！走到醫院格，停費一輪。醫療費25,000H。有醫療保險可領賠50,000H。', cashLoss: 25000, goToSquare: 'hospital', missRounds: 1, insurancePays: 50000 },
  { id: 'C037', title: '運動意外', type: 'medical', description: '運動意外！走到醫院格，停費一輪。醫療費20,000H。有醫療保險可領賠50,000H。', cashLoss: 20000, goToSquare: 'hospital', missRounds: 1, insurancePays: 50000 },

  // ─── 天有不測風雲：飛行器類（C038–C040）───
  // Only triggers if player owns a 飛行器
  { id: 'C038', title: '飛行器被偷', type: 'aircraft_damage', description: '飛行器被偷！失去飛行器一艘，扣除幸福點，貸款不消。有產物保險賠400,000H（購買價80%）。', cashLoss: 0, happinessLoss: 2, insurancePays: 400000 },
  { id: 'C039', title: '飛行器撞樹事故', type: 'aircraft_damage', description: '飛行器撞樹事故！走到飛行器4S店，停費一輪，維修費100,000H。有保險免費維修。', cashLoss: 100000, goToSquare: '4s_shop', missRounds: 1, insurancePays: 100000 },
  { id: 'C040', title: '與他人飛行器相撞', type: 'aircraft_damage', description: '與他人飛行器相撞！維修費200,000H。有保險免費維修。', cashLoss: 200000, insurancePays: 200000 },

  // ─── 天有不測風雲：出租住宅修繕（C041–C043）───
  // Only triggers if player owns rental properties; full insurance on all properties = free
  { id: 'C041', title: '地震', type: 'property_repair', description: '地震！所有出租用住宅需支付修繕費200,000H。若所有出租住宅都有房屋保險則免費。', cashLoss: 200000, insurancePays: 200000 },
  { id: 'C042', title: '線路起火', type: 'property_repair', description: '線路起火！所有出租用住宅需支付修繕費100,000H。若所有出租住宅都有房屋保險則免費。', cashLoss: 100000, insurancePays: 100000 },
  { id: 'C043', title: '年久失修', type: 'property_repair', description: '年久失修！所有出租用住宅需支付修繕費150,000H。若所有出租住宅都有房屋保險則免費。', cashLoss: 150000, insurancePays: 150000 },

  // ─── 財物損失（C044）───
  { id: 'C044', title: '錢包被盜', type: 'theft', description: '錢包被盜！損失8,000H。', cashLoss: 8000 },

  // ─── 通貨膨脹（C045–C048）───
  // Affects ALL players permanently (monthly expense increase)
  { id: 'C045', title: '食品漲價', type: 'inflation', description: '食品漲價！所有玩家飲食費用永久增加3,000H/月。', monthlyExpenseChange: 3000, affectsAllPlayers: true },
  { id: 'C046', title: '服飾漲價', type: 'inflation', description: '服飾漲價！所有玩家服飾費用永久增加2,000H/月。', monthlyExpenseChange: 2000, affectsAllPlayers: true },
  { id: 'C047', title: '油價上漲', type: 'inflation', description: '油價上漲！所有玩家交通費用永久增加2,000H/月。', monthlyExpenseChange: 2000, affectsAllPlayers: true },
  { id: 'C048', title: '日用品漲價', type: 'inflation', description: '日用品漲價！所有玩家居住費用永久增加1,000H/月。', monthlyExpenseChange: 1000, affectsAllPlayers: true },

  // ─── 特殊的事件（C049–C056）───
  { id: 'C049', title: '違規闖紅燈', type: 'penalty', description: '違規闖紅燈！向銀行支付罰款2,000H。', cashLoss: 2000 },
  { id: 'C050', title: '衝動消費買包包', type: 'penalty', description: '衝動消費買包包！向銀行支付5,000H。', cashLoss: 5000 },
  { id: 'C051', title: '拾金不昧', type: 'reward', description: '拾金不昧！抽取一張幸福卡。', drawCard: 'happiness' },
  { id: 'C052', title: '遺失鑰匙找鎖匠', type: 'penalty', description: '遺失鑰匙找鎖匠！向銀行支付3,000H。', cashLoss: 3000 },
  { id: 'C053', title: '熱心助人', type: 'reward', description: '熱心助人！說出3種助人的做法後，抽取一張幸福卡。', drawCard: 'happiness', requiresStorySharing: true },
  { id: 'C054', title: '資源回收', type: 'reward', description: '資源回收！說出3種資源回收做法後，月支出其他欄永久減少500H。', monthlyExpenseChange: -500, requiresStorySharing: true },
  { id: 'C055', title: '奉獻所得', type: 'reward', description: '奉獻所得！所有願意參與的玩家，月支出其他欄+2,000H，並各抽取一張幸福卡。', monthlyExpenseChange: 2000, drawCard: 'happiness', affectsAllPlayers: true },
  { id: 'C056', title: '善用時間', type: 'reward', description: '善用時間！說出3種善用時間的做法後，抽取一張新聞卡。', drawCard: 'news', requiresStorySharing: true },
];

// ===== NEWS CARDS (新聞卡) =====

export interface StockSymbolPrices {
  A10: number;
  A20: number;
  A30: number;
  A40: number;
  B50: number;
  B60: number;
  B70: number;
  B80: number;
}

export interface StockPriceNewsCard {
  id: string;
  type: 'stock_price';
  subtype: '股市新訊';
  title: string;
  prices: StockSymbolPrices;   // new market prices in H; 1張 = 100 shares
  specialRule?: string;
}

export interface CashDividendNewsCard {
  id: string;
  type: 'cash_dividend';
  subtype: '股市新訊';
  title: string;
  // Total cash = qty(張) × 100 × dividendPerShare
  dividendPerShare: StockSymbolPrices;
}

export interface StockDividendNewsCard {
  id: string;
  type: 'stock_dividend';
  subtype: '股市新訊';
  title: string;
  // New shares = currentShares × (1 + rate); round up to nearest 張
  dividendRate: StockSymbolPrices;
}

export interface RealEstateNewsCard {
  id: string;
  type: 'real_estate';
  subtype: '房市新訊';
  title: string;
  description?: string;
  propertyLabel: string;
  houseType: '1room' | '2room' | '3room' | '5room' | 'store_small' | 'store_medium' | 'store_large';
  totalPrice: number;
  downPayment: number;
  loanAmount: number;
  monthlyPayment: number;    // principal + interest per month
  rent: number;
  netRentIncome: number;     // rent - monthlyPayment
  happinessBonus: number;    // 0 for commercial properties
  canSelfUse: boolean;
}

export interface SmallBusinessNewsCard {
  id: string;
  type: 'small_business';
  subtype: '企業新訊';
  title: string;
  loanAmount: number;
  investmentPerMonth: number;
  interestPerMonth: number;
  // Note: passing bank square and rolling ≥5 upgrades to 小型企業 (loan cancelled, income = investmentPoints × 10,000)
}

export interface LargeEnterpriseNewsCard {
  id: string;
  type: 'large_enterprise';
  subtype: '企業新訊';
  title: string;
  businessName: string;
  loanAmount: number;
  maxInvestment: number;            // maximum investment in H
  monthlyReturnPerMillion: number;  // income per 1,000,000H invested
}

export type NewsCard =
  | StockPriceNewsCard
  | CashDividendNewsCard
  | StockDividendNewsCard
  | RealEstateNewsCard
  | SmallBusinessNewsCard
  | LargeEnterpriseNewsCard;

export const NEWS_CARDS: NewsCard[] = [
  // ─── 股市新訊：股價變動（N001–N026）───
  // All players may buy/sell at the listed prices; unit = 張 (100 shares)
  {
    id: 'N001', type: 'stock_price', subtype: '股市新訊', title: '百年榮景',
    prices: { A10: 8500, A20: 7500, A30: 10500, A40: 12000, B50: 9500, B60: 11000, B70: 16000, B80: 20000 },
  },
  {
    id: 'N002', type: 'stock_price', subtype: '股市新訊', title: '泡沫化大跌',
    prices: { A10: 800, A20: 700, A30: 600, A40: 800, B50: 600, B60: 400, B70: 800, B80: 1000 },
    specialRule: '所有持股數減半，不足1張捨去',
  },
  {
    id: 'N003', type: 'stock_price', subtype: '股市新訊', title: '振興政策大漲',
    prices: { A10: 6500, A20: 6000, A30: 12000, A40: 9500, B50: 8000, B60: 9500, B70: 12500, B80: 16000 },
  },
  {
    id: 'N004', type: 'stock_price', subtype: '股市新訊', title: '通貨緊縮',
    prices: { A10: 800, A20: 700, A30: 1000, A40: 1500, B50: 1100, B60: 500, B70: 1500, B80: 2000 },
  },
  {
    id: 'N005', type: 'stock_price', subtype: '股市新訊', title: '景氣大好',
    prices: { A10: 6000, A20: 6500, A30: 14000, A40: 8000, B50: 7500, B60: 9000, B70: 12000, B80: 14000 },
  },
  {
    id: 'N006', type: 'stock_price', subtype: '股市新訊', title: '呆帳企業虧損',
    prices: { A10: 1000, A20: 1200, A30: 1000, A40: 1500, B50: 1200, B60: 800, B70: 2000, B80: 1500 },
  },
  {
    id: 'N007', type: 'stock_price', subtype: '股市新訊', title: '新科技',
    prices: { A10: 5500, A20: 6000, A30: 10000, A40: 7500, B50: 7000, B60: 8500, B70: 9500, B80: 13000 },
  },
  {
    id: 'N008', type: 'stock_price', subtype: '股市新訊', title: '傳染病疫情',
    prices: { A10: 1100, A20: 1700, A30: 2000, A40: 1200, B50: 1800, B60: 500, B70: 6000, B80: 2500 },
  },
  {
    id: 'N009', type: 'stock_price', subtype: '股市新訊', title: '減稅振興',
    prices: { A10: 5500, A20: 4500, A30: 9500, A40: 7000, B50: 7000, B60: 7500, B70: 10000, B80: 12500 },
  },
  {
    id: 'N010', type: 'stock_price', subtype: '股市新訊', title: '氣候異常歉收',
    prices: { A10: 1500, A20: 1500, A30: 2500, A40: 2000, B50: 2200, B60: 1500, B70: 3000, B80: 3500 },
  },
  {
    id: 'N011', type: 'stock_price', subtype: '股市新訊', title: '教育政策',
    prices: { A10: 4500, A20: 4000, A30: 9000, A40: 6500, B50: 8500, B60: 7000, B70: 9500, B80: 11000 },
  },
  {
    id: 'N012', type: 'stock_price', subtype: '股市新訊', title: '提高稅率',
    prices: { A10: 2000, A20: 1500, A30: 3000, A40: 2200, B50: 2500, B60: 2200, B70: 2800, B80: 3000 },
  },
  {
    id: 'N013', type: 'stock_price', subtype: '股市新訊', title: '農產豐收',
    prices: { A10: 8000, A20: 4000, A30: 8500, A40: 6000, B50: 6500, B60: 6000, B70: 8000, B80: 10000 },
  },
  {
    id: 'N014', type: 'stock_price', subtype: '股市新訊', title: '工程延誤',
    prices: { A10: 4000, A20: 5000, A30: 2500, A40: 3000, B50: 3500, B60: 3000, B70: 3200, B80: 4000 },
  },
  {
    id: 'N015', type: 'stock_price', subtype: '股市新訊', title: '觀光周活動',
    prices: { A10: 5500, A20: 5000, A30: 7500, A40: 6500, B50: 6000, B60: 8000, B70: 7500, B80: 9500 },
  },
  {
    id: 'N016', type: 'stock_price', subtype: '股市新訊', title: '失業率提高',
    prices: { A10: 2000, A20: 2600, A30: 3000, A40: 3500, B50: 3000, B60: 2500, B70: 4000, B80: 5000 },
  },
  {
    id: 'N017', type: 'stock_price', subtype: '股市新訊', title: '新藥研發',
    prices: { A10: 4500, A20: 5000, A30: 5000, A40: 6000, B50: 5500, B60: 7000, B70: 11500, B80: 9000 },
  },
  {
    id: 'N018', type: 'stock_price', subtype: '股市新訊', title: '季報不如預期',
    prices: { A10: 2200, A20: 2800, A30: 3000, A40: 3500, B50: 2500, B60: 4000, B70: 5000, B80: 6000 },
  },
  {
    id: 'N019', type: 'stock_price', subtype: '股市新訊', title: '財政緊縮',
    prices: { A10: 2300, A20: 3000, A30: 2000, A40: 3500, B50: 3000, B60: 4000, B70: 5500, B80: 6500 },
  },
  {
    id: 'N020', type: 'stock_price', subtype: '股市新訊', title: '礦場意外',
    prices: { A10: 2500, A20: 3000, A30: 2200, A40: 4000, B50: 3500, B60: 4500, B70: 6000, B80: 7000 },
  },
  {
    id: 'N021', type: 'stock_price', subtype: '股市新訊', title: '景氣溫和',
    prices: { A10: 3500, A20: 4000, A30: 7000, A40: 5000, B50: 5000, B60: 5500, B70: 7500, B80: 8500 },
  },
  {
    id: 'N022', type: 'stock_price', subtype: '股市新訊', title: '鼓勵生育',
    prices: { A10: 6500, A20: 6000, A30: 6000, A40: 4500, B50: 4000, B60: 5000, B70: 6000, B80: 8000 },
  },
  {
    id: 'N023', type: 'stock_price', subtype: '股市新訊', title: '降低銀行利率',
    prices: { A10: 3500, A20: 3000, A30: 7000, A40: 5000, B50: 5000, B60: 5000, B70: 7000, B80: 8000 },
  },
  {
    id: 'N024', type: 'stock_price', subtype: '股市新訊', title: '開學季文具',
    prices: { A10: 4500, A20: 6500, A30: 5500, A40: 6000, B50: 9000, B60: 3000, B70: 6000, B80: 8500 },
  },
  {
    id: 'N025', type: 'stock_price', subtype: '股市新訊', title: '大型運動賽事',
    prices: { A10: 8500, A20: 4500, A30: 6000, A40: 7000, B50: 3000, B60: 7500, B70: 4000, B80: 8000 },
  },
  {
    id: 'N026', type: 'stock_price', subtype: '股市新訊', title: '新能源降運輸成本',
    prices: { A10: 3000, A20: 2500, A30: 6500, A40: 8000, B50: 4000, B60: 4500, B70: 6000, B80: 9500 },
  },

  // ─── 股市新訊：現金股利（N027）───
  // Total cash received = qty(張) × 100 shares × dividendPerShare(H)
  {
    id: 'N027', type: 'cash_dividend', subtype: '股市新訊', title: '股利發放',
    dividendPerShare: { A10: 4, A20: 3, A30: 5, A40: 5, B50: 4, B60: 4, B70: 6, B80: 7 },
  },

  // ─── 股市新訊：股票股息（N028）───
  // New total shares = current × (1 + rate); round up any fraction to nearest 張
  {
    id: 'N028', type: 'stock_dividend', subtype: '股市新訊', title: '股息發放',
    dividendRate: { A10: 0.40, A20: 0.30, A30: 0.50, A40: 0.50, B50: 0.40, B60: 0.40, B70: 0.60, B80: 0.70 },
  },

  // ─── 房市新訊（N029–N054）───
  // All players may purchase (drawer has priority); card stays public until bought
  {
    id: 'N029', type: 'real_estate', subtype: '房市新訊', title: '單間小套房出售',
    propertyLabel: '單間小套房', houseType: '1room',
    totalPrice: 1100000, downPayment: 100000, loanAmount: 1000000,
    monthlyPayment: 5000, rent: 6500, netRentIncome: 1500, happinessBonus: 2, canSelfUse: true,
  },
  {
    id: 'N030', type: 'real_estate', subtype: '房市新訊', title: '單間小套房出售',
    propertyLabel: '單間小套房', houseType: '1room',
    totalPrice: 1050000, downPayment: 50000, loanAmount: 1000000,
    monthlyPayment: 5000, rent: 7000, netRentIncome: 2000, happinessBonus: 2, canSelfUse: true,
  },
  {
    id: 'N031', type: 'real_estate', subtype: '房市新訊', title: '單間小套房出售',
    propertyLabel: '單間小套房', houseType: '1room',
    totalPrice: 1000000, downPayment: 100000, loanAmount: 900000,
    monthlyPayment: 4500, rent: 5500, netRentIncome: 1000, happinessBonus: 2, canSelfUse: true,
  },
  {
    id: 'N032', type: 'real_estate', subtype: '房市新訊', title: '舊屋翻新單間小套房',
    description: '舊屋翻新。屋齡老舊的一室一廳單間小套房，重新裝修出售。周遭生活機能良好，近市集和學校。',
    propertyLabel: '單間小套房', houseType: '1room',
    totalPrice: 1200000, downPayment: 200000, loanAmount: 1000000,
    monthlyPayment: 5000, rent: 5000, netRentIncome: 0, happinessBonus: 2, canSelfUse: true,
  },
  {
    id: 'N033', type: 'real_estate', subtype: '房市新訊', title: '單間小套房出售',
    propertyLabel: '單間小套房', houseType: '1room',
    totalPrice: 1800000, downPayment: 300000, loanAmount: 1500000,
    monthlyPayment: 7500, rent: 10000, netRentIncome: 2500, happinessBonus: 2, canSelfUse: true,
  },
  {
    id: 'N034', type: 'real_estate', subtype: '房市新訊', title: '單間小套房出售',
    propertyLabel: '單間小套房', houseType: '1room',
    totalPrice: 1500000, downPayment: 200000, loanAmount: 1300000,
    monthlyPayment: 6500, rent: 7000, netRentIncome: 500, happinessBonus: 2, canSelfUse: true,
  },
  {
    id: 'N035', type: 'real_estate', subtype: '房市新訊', title: '兩室一廳出售',
    propertyLabel: '兩室一廳', houseType: '2room',
    totalPrice: 3000000, downPayment: 600000, loanAmount: 2400000,
    monthlyPayment: 12000, rent: 14000, netRentIncome: 2000, happinessBonus: 4, canSelfUse: true,
  },
  {
    id: 'N036', type: 'real_estate', subtype: '房市新訊', title: '兩室一廳出售',
    propertyLabel: '兩室一廳', houseType: '2room',
    totalPrice: 3600000, downPayment: 600000, loanAmount: 3000000,
    monthlyPayment: 15000, rent: 15000, netRentIncome: 0, happinessBonus: 4, canSelfUse: true,
  },
  {
    id: 'N037', type: 'real_estate', subtype: '房市新訊', title: '兩室一廳出售',
    propertyLabel: '兩室一廳', houseType: '2room',
    totalPrice: 2000000, downPayment: 200000, loanAmount: 1800000,
    monthlyPayment: 9000, rent: 12000, netRentIncome: 3000, happinessBonus: 4, canSelfUse: true,
  },
  {
    id: 'N038', type: 'real_estate', subtype: '房市新訊', title: '兩室一廳出售',
    propertyLabel: '兩室一廳', houseType: '2room',
    totalPrice: 2800000, downPayment: 300000, loanAmount: 2500000,
    monthlyPayment: 12500, rent: 10000, netRentIncome: -2500, happinessBonus: 4, canSelfUse: true,
  },
  {
    id: 'N039', type: 'real_estate', subtype: '房市新訊', title: '三室兩廳出售',
    propertyLabel: '三室兩廳', houseType: '3room',
    totalPrice: 4500000, downPayment: 500000, loanAmount: 4000000,
    monthlyPayment: 20000, rent: 18000, netRentIncome: -2000, happinessBonus: 6, canSelfUse: true,
  },
  {
    id: 'N040', type: 'real_estate', subtype: '房市新訊', title: '三室兩廳出售',
    propertyLabel: '三室兩廳', houseType: '3room',
    totalPrice: 3500000, downPayment: 300000, loanAmount: 3200000,
    monthlyPayment: 16000, rent: 20000, netRentIncome: 4000, happinessBonus: 6, canSelfUse: true,
  },
  {
    id: 'N041', type: 'real_estate', subtype: '房市新訊', title: '三室兩廳出售',
    propertyLabel: '三室兩廳', houseType: '3room',
    totalPrice: 4500000, downPayment: 500000, loanAmount: 4000000,
    monthlyPayment: 20000, rent: 22000, netRentIncome: 2000, happinessBonus: 6, canSelfUse: true,
  },
  {
    id: 'N042', type: 'real_estate', subtype: '房市新訊', title: '三室兩廳出售',
    propertyLabel: '三室兩廳', houseType: '3room',
    totalPrice: 5000000, downPayment: 500000, loanAmount: 4500000,
    monthlyPayment: 22500, rent: 20000, netRentIncome: -2500, happinessBonus: 6, canSelfUse: true,
  },
  {
    id: 'N043', type: 'real_estate', subtype: '房市新訊', title: '五室三廳豪宅出售',
    propertyLabel: '五室三廳豪宅', houseType: '5room',
    totalPrice: 15000000, downPayment: 5000000, loanAmount: 10000000,
    monthlyPayment: 50000, rent: 55000, netRentIncome: 5000, happinessBonus: 8, canSelfUse: true,
  },
  {
    id: 'N044', type: 'real_estate', subtype: '房市新訊', title: '五室三廳豪宅出售',
    propertyLabel: '五室三廳豪宅', houseType: '5room',
    totalPrice: 12000000, downPayment: 1200000, loanAmount: 10800000,
    monthlyPayment: 54000, rent: 50000, netRentIncome: -4000, happinessBonus: 8, canSelfUse: true,
  },
  {
    id: 'N045', type: 'real_estate', subtype: '房市新訊', title: '五室三廳豪宅出售',
    propertyLabel: '五室三廳豪宅', houseType: '5room',
    totalPrice: 16000000, downPayment: 5000000, loanAmount: 11000000,
    monthlyPayment: 55000, rent: 55000, netRentIncome: 0, happinessBonus: 8, canSelfUse: true,
  },
  {
    id: 'N046', type: 'real_estate', subtype: '房市新訊', title: '五室三廳豪宅出售',
    propertyLabel: '五室三廳豪宅', houseType: '5room',
    totalPrice: 9000000, downPayment: 1000000, loanAmount: 8000000,
    monthlyPayment: 40000, rent: 50000, netRentIncome: 10000, happinessBonus: 8, canSelfUse: true,
  },
  {
    id: 'N047', type: 'real_estate', subtype: '房市新訊', title: '小型店面出售',
    propertyLabel: '小型店面', houseType: 'store_small',
    totalPrice: 1200000, downPayment: 120000, loanAmount: 1080000,
    monthlyPayment: 5400, rent: 15000, netRentIncome: 9600, happinessBonus: 0, canSelfUse: false,
  },
  {
    id: 'N048', type: 'real_estate', subtype: '房市新訊', title: '小型店面出售',
    propertyLabel: '小型店面', houseType: 'store_small',
    totalPrice: 1800000, downPayment: 180000, loanAmount: 1620000,
    monthlyPayment: 8100, rent: 20000, netRentIncome: 11900, happinessBonus: 0, canSelfUse: false,
  },
  {
    id: 'N049', type: 'real_estate', subtype: '房市新訊', title: '小型店面出售',
    propertyLabel: '小型店面', houseType: 'store_small',
    totalPrice: 1000000, downPayment: 80000, loanAmount: 920000,
    monthlyPayment: 4600, rent: 10000, netRentIncome: 5400, happinessBonus: 0, canSelfUse: false,
  },
  {
    id: 'N050', type: 'real_estate', subtype: '房市新訊', title: '商業區小型店面出售',
    description: '商業區小型店面求售。',
    propertyLabel: '小型店面', houseType: 'store_small',
    totalPrice: 2000000, downPayment: 400000, loanAmount: 1600000,
    monthlyPayment: 8000, rent: 22000, netRentIncome: 14000, happinessBonus: 0, canSelfUse: false,
  },
  {
    id: 'N051', type: 'real_estate', subtype: '房市新訊', title: '中型店面出售',
    propertyLabel: '中型店面', houseType: 'store_medium',
    totalPrice: 5000000, downPayment: 1000000, loanAmount: 4000000,
    monthlyPayment: 20000, rent: 40000, netRentIncome: 20000, happinessBonus: 0, canSelfUse: false,
  },
  {
    id: 'N052', type: 'real_estate', subtype: '房市新訊', title: '商業區中型店面出售',
    description: '商業區中型店面求售。',
    propertyLabel: '中型店面', houseType: 'store_medium',
    totalPrice: 6000000, downPayment: 3000000, loanAmount: 3000000,
    monthlyPayment: 15000, rent: 60000, netRentIncome: 45000, happinessBonus: 0, canSelfUse: false,
  },
  {
    id: 'N053', type: 'real_estate', subtype: '房市新訊', title: '大型店面出售',
    propertyLabel: '大型店面', houseType: 'store_large',
    totalPrice: 12000000, downPayment: 4000000, loanAmount: 8000000,
    monthlyPayment: 40000, rent: 150000, netRentIncome: 110000, happinessBonus: 0, canSelfUse: false,
  },
  {
    id: 'N054', type: 'real_estate', subtype: '房市新訊', title: '大型店面出售',
    propertyLabel: '大型店面', houseType: 'store_large',
    totalPrice: 16000000, downPayment: 6000000, loanAmount: 10000000,
    monthlyPayment: 50000, rent: 200000, netRentIncome: 150000, happinessBonus: 0, canSelfUse: false,
  },

  // ─── 企業新訊：大型企業投資（N055）───
  // All players may participate; invest in multiples of 1,000,000H; max 50,000,000H
  {
    id: 'N055', type: 'large_enterprise', subtype: '企業新訊', title: '優質大型企業徵求合夥人',
    businessName: '遊樂園',
    loanAmount: 0,
    maxInvestment: 50000000,
    monthlyReturnPerMillion: 200000,
  },

  // ─── 企業新訊：兼職工作室貸款（N056–N058）───
  // All players may join; passing bank square and rolling ≥5 upgrades to 小型企業
  // (loan cancelled; monthly income = investmentPoints × 10,000H)
  {
    id: 'N056', type: 'small_business', subtype: '企業新訊', title: '創業貸款',
    loanAmount: 500000, investmentPerMonth: 3000, interestPerMonth: 1500,
  },
  {
    id: 'N057', type: 'small_business', subtype: '企業新訊', title: '創業貸款',
    loanAmount: 600000, investmentPerMonth: 5000, interestPerMonth: 3000,
  },
  {
    id: 'N058', type: 'small_business', subtype: '企業新訊', title: '創業貸款',
    loanAmount: 600000, investmentPerMonth: 5000, interestPerMonth: 3000,
  },
];

// ─── Helper lookups ───

export const HAPPINESS_CARD_MAP = Object.fromEntries(
  HAPPINESS_CARDS.map(c => [c.id, c])
) as Record<string, HappinessCard>;

export const OPPORTUNITY_CARD_MAP = Object.fromEntries(
  OPPORTUNITY_CARDS.map(c => [c.id, c])
) as Record<string, OpportunityCard>;

export const NEWS_CARD_MAP = Object.fromEntries(
  NEWS_CARDS.map(c => [c.id, c])
) as Record<string, NewsCard>;

export const STOCK_NEWS_CARDS = NEWS_CARDS.filter(
  (c): c is StockPriceNewsCard => c.type === 'stock_price'
);

export const REAL_ESTATE_NEWS_CARDS = NEWS_CARDS.filter(
  (c): c is RealEstateNewsCard => c.type === 'real_estate'
);
