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
  description?: string;
}

export const HAPPINESS_CARDS: HappinessCard[] = [
  // ─── 我的幸福回憶（H001–H010）───
  // Effect: share a personal story → +2 happiness, no cost
  { id: 'H001', title: '得獎經歷', description: '因為努力學習和練習，獲得一個獎項，在頒獎台上接受眾人的掌聲和鼓勵。', category: '幸福回憶', happinessPoints: 2, requiresStorySharing: true },
  { id: 'H002', title: '助人為善', description: '曾經認真的幫助他人。因為我的善心，幫助了一位需要幫助的人，他對我非常感激。', category: '幸福回憶', happinessPoints: 2, requiresStorySharing: true },
  { id: 'H003', title: '特別成就', description: '我曾經很認真、很努力地完成一件特別的事情，完成之後獲得終身難忘的成就感。', category: '幸福回憶', happinessPoints: 2, requiresStorySharing: true },
  { id: 'H004', title: '美麗的事物', description: `我曾經遇過一個非常喜愛的事物（藝術品、音樂、美景等皆可），每次回想起這個事物，就覺得很快樂。`, category: '幸福回憶', happinessPoints: 2, requiresStorySharing: true },
  { id: 'H005', title: '難忘的旅程', description: '我曾經有過一次旅程，這個旅程給了我相當難忘的經歷，每次回想起都令人相當愉悅。', category: '幸福回憶', happinessPoints: 2, requiresStorySharing: true },
  { id: 'H006', title: '自豪的創作', description: '我曾經很認真、很努力地完成一件滿意的作品（美術、工藝、文學、音樂皆可），完成後相當自豪。', category: '幸福回憶', happinessPoints: 2, requiresStorySharing: true },
  { id: 'H007', title: '特別的故事', description: '我曾經聽過一個特別的小故事或是寓言，這個故事可以帶人們對人生有一種新的感悟。', category: '幸福回憶', happinessPoints: 2, requiresStorySharing: true },
  { id: 'H008', title: '快樂的經歷', description: '我曾經有過一次非常快樂的經驗，這個經驗讓我印象深刻且終身難忘。', category: '幸福回憶', happinessPoints: 2, requiresStorySharing: true },
  { id: 'H009', title: '美味的大餐', description: '我曾經有過一次豪華的大餐，每次回想起都相當讓人回味無窮，還想要再享受一次。', category: '幸福回憶', happinessPoints: 2, requiresStorySharing: true },
  { id: 'H010', title: '年幼時的玩伴', description: '我在年幼時，曾經有過一位感情相當好的玩伴，每次回想起跟他相處的時光，都讓人相當快樂。', category: '幸福回憶', happinessPoints: 2, requiresStorySharing: true },

  // ─── 幸福家庭的重要歷程（H011–H020）───
  // Multi-step series; other players roll ≥4 to join each step
  { id: 'H011', title: '幸福家庭的重要歷程', description: '抽到卡片的玩家，可以自由決定是否依序完成一項歷程，並獲得對應的幸福點（最多只有兩個孩子）。其他玩家也有機會參與，但須先擲骰子，使其大於等於4，才能完成一項歷程。', category: '家庭重要歷程', happinessPoints: 2, cashCost: 3000, otherPlayersCanJoin: true, joinDiceMin: 4 },
  { id: 'H012', title: '幸福家庭的重要歷程', description: '抽到卡片的玩家，可以自由決定是否依序完成一項歷程，並獲得對應的幸福點（最多只有兩個孩子）。其他玩家也有機會參與，但須先擲骰子，使其大於等於4，才能完成一項歷程。', category: '家庭重要歷程', happinessPoints: 2, cashCost: 5000, otherPlayersCanJoin: true, joinDiceMin: 4 },
  { id: 'H013', title: '幸福家庭的重要歷程', description: '抽到卡片的玩家，可以自由決定是否依序完成一項歷程，並獲得對應的幸福點（最多只有兩個孩子）。其他玩家也有機會參與，但須先擲骰子，使其大於等於4，才能完成一項歷程。', category: '家庭重要歷程', happinessPoints: 2, cashCost: 100000, otherPlayersCanJoin: true, joinDiceMin: 4 },
  { id: 'H014', title: '幸福家庭的重要歷程', description: '抽到卡片的玩家，可以自由決定是否依序完成一項歷程，並獲得對應的幸福點（最多只有兩個孩子）。其他玩家也有機會參與，但須先擲骰子，使其大於等於4，才能完成一項歷程。', category: '家庭重要歷程', happinessPoints: 2, monthlyExpenseIncrease: 10000, childrenIncrease: 1, otherPlayersCanJoin: true, joinDiceMin: 4 },
  { id: 'H015', title: '幸福家庭的重要歷程', description: '抽到卡片的玩家，可以自由決定是否依序完成一項歷程，並獲得對應的幸福點（最多只有兩個孩子）。其他玩家也有機會參與，但須先擲骰子，使其大於等於4，才能完成一項歷程。', category: '家庭重要歷程', happinessPoints: 2, monthlyExpenseIncrease: 10000, childrenIncrease: 1, otherPlayersCanJoin: true, joinDiceMin: 4 },
  // TODO: verify exact titles and costs for H016–H020
  { id: 'H016', title: '幸福家庭的重要歷程', description: '抽到卡片的玩家，可以自由決定是否依序完成一項歷程，並獲得對應的幸福點（最多只有兩個孩子）。其他玩家也有機會參與，但須先擲骰子，使其大於等於4，才能完成一項歷程。', category: '家庭重要歷程', happinessPoints: 2, otherPlayersCanJoin: true, joinDiceMin: 4 },
  { id: 'H017', title: '幸福家庭的重要歷程', description: '抽到卡片的玩家，可以自由決定是否依序完成一項歷程，並獲得對應的幸福點（最多只有兩個孩子）。其他玩家也有機會參與，但須先擲骰子，使其大於等於4，才能完成一項歷程。', category: '家庭重要歷程', happinessPoints: 2, otherPlayersCanJoin: true, joinDiceMin: 4 },
  { id: 'H018', title: '幸福家庭的重要歷程', description: '抽到卡片的玩家，可以自由決定是否依序完成一項歷程，並獲得對應的幸福點（最多只有兩個孩子）。其他玩家也有機會參與，但須先擲骰子，使其大於等於4，才能完成一項歷程。', category: '家庭重要歷程', happinessPoints: 2, otherPlayersCanJoin: true, joinDiceMin: 4 },
  { id: 'H019', title: '幸福家庭的重要歷程', description: '抽到卡片的玩家，可以自由決定是否依序完成一項歷程，並獲得對應的幸福點（最多只有兩個孩子）。其他玩家也有機會參與，但須先擲骰子，使其大於等於4，才能完成一項歷程。', category: '家庭重要歷程', happinessPoints: 2, otherPlayersCanJoin: true, joinDiceMin: 4 },
  { id: 'H020', title: '幸福家庭的重要歷程', description: '抽到卡片的玩家，可以自由決定是否依序完成一項歷程，並獲得對應的幸福點（最多只有兩個孩子）。其他玩家也有機會參與，但須先擲骰子，使其大於等於4，才能完成一項歷程。', category: '家庭重要歷程', happinessPoints: 2, otherPlayersCanJoin: true, joinDiceMin: 4 },

  // ─── 追求家庭的幸福（H021–H030）───
  // One-time cost, +2 happiness; TODO: verify individual costs (range: 6,000–50,000)
  { id: 'H021', title: '特別節日的家庭晚宴', description: `一場溫馨快樂的家庭聚會無價！`, category: '追求家庭幸福', happinessPoints: 2, cashCost: 15200 },
  { id: 'H022', title: '全家一起旅遊', description: '在家人的期待下，帶全家人一同到以遊戲與觀光知名的城市，進行七天六夜的旅行，給全家人帶來一個終身難忘的快樂回憶。', category: '追求家庭幸福', happinessPoints: 2, cashCost: 10000 },
  { id: 'H023', title: '為家人準備一個隆重的生日宴會', description: '今年的生日對家人有特別的意義，為了這個生日，特別花了心思，舉辦了一場盛大隆重的生日宴會，邀請親朋好友前來一起慶生。', category: '追求家庭幸福', happinessPoints: 2, cashCost: 8000 },
  { id: 'H024', title: '安排全家人的健康檢查', description: '現在又到了一年一度健康檢查的時間。每年都會安排一個固定的時間，為全家人安排一次全身的健康檢查，來維護全家人的健康。', category: '追求家庭幸福', happinessPoints: 2, cashCost: 30000 },
  { id: 'H025', title: '參與一場盛大的家族聚會', description: '帶著全家人一起出訪，參加一次盛大的兩天一夜家族聚會。許多久沒有見面的親人將會同聚一堂，聯繫情感。', category: '追求家庭幸福', happinessPoints: 2, cashCost: 15000 },
  { id: 'H026', title: '孩子的才藝活動', description: '孩子參加的才藝課程，將舉行一個發表活動。除夜了參加活動發表，晚上特別為孩子舉行一場慶功宴，犒賞孩子的努力。*（還沒有孩子的玩家無效）*', category: '追求家庭幸福', happinessPoints: 2, cashCost: 6000 },
  { id: 'H027', title: '為自己的伴侶準備一個驚喜', description: '在一個值得紀念的日子中，為自己的伴侶安排一個J特別的兩人約會，並為對方精心準備一份令人驚喜的禮物，來慶祝這一個對兩人有特別意義的日子。*（至少與心儀對象有過一次約會的玩家有效）*', category: '追求家庭幸福', happinessPoints: 2, cashCost: 6000 },
  { id: 'H028', title: '給父母的回報', description: '感謝父母辛苦地把自己扶養長大，並提供良好的教育環境，讓自己成為一位優秀的人才。抽到卡片的玩家，自由決定是否要在月支出的其他欄多增加3,000，來獲得幸福點2點。', category: '追求家庭幸福', happinessPoints: 2, cashCost: 6000 },
  { id: 'H029', title: '自己的健康是家庭幸福的來源', description: '健康出現了警訊。聽從醫生的建議，每天最少要運動三十分鐘，才能保持身邊的健康。為了這件事，你特別買了整組的家用運動設備。', category: '追求家庭幸福', happinessPoints: 2, cashCost: 10000 },
  { id: 'H030', title: '自己的健康是家庭幸福的來源', description: '健康出現了警訊。聽從醫生的建議，調整飲食習慣，才能保持身邊的健康。所以每個月將多花 2,000，來為家人準備更為健康的飲食。抽到卡片的玩家，自由決定是否要在月支出的飲食欄多增加 2,000改善飲食，來獲得幸福點2點。', category: '追求家庭幸福', happinessPoints: 2, cashCost: 6000 },

  // ─── 良好的人際關係（H031–H038）───
  // Monthly expense increase, +2 happiness; TODO: verify individual amounts (range: 2,000–3,000/month)
  { id: 'H031', title: '每年的同學會', description: '你非常珍惜和同窗之間的情誼，願意每年都會抽空，主持一場同學會，跟已經畢業的老同學們相聚。抽到卡片的玩家，自由決定是否要在月支出的娛樂欄多增加 2,000，來獲得幸福點2點。', category: '良好人際關係', happinessPoints: 2, monthlyExpenseIncrease: 2000 },
  { id: 'H032', title: '加入一個培養興趣的社團', description: '擁有一個陶治性情的興趣，可以為你帶來快樂和幸福感。你願意每個月花一點時間和一筆錢，參加一個和興趣相關的社團，跟一群志同道合的朋友培養興趣。抽到卡片的玩家，自由決定是否要在月支出的娛樂欄多增加3,000，來獲得幸福點2點。', category: '良好人際關係', happinessPoints: 2, monthlyExpenseIncrease: 2000 },
  { id: 'H033', title: '親友的婚禮', description: '親友結婚贈送紅包或禮物，可以維持彼此的情誼。若是每一個月預先支配一小筆紅包錢，為未來親友結婚時做準備，就不會給自己在經濟上帶來太多的壓力。抽到卡片的玩家，自由決定是否要在月支出的娛樂欄多增加 2,000，來獲得幸福點2點。', category: '良好人際關係', happinessPoints: 2, monthlyExpenseIncrease: 2000 },
  { id: 'H034', title: '社團的好鄰居', description: '遠親不如近鄰。平常熱心參與社區或鄰里之間的小活動，和鄰居們維持良好的互動關係，在生活上和人際上，會為自己帶來許多幫助。抽到卡片的玩家，自由決定是否要在月支出的居住欄多增加 2,000，來獲得幸福點2點。', category: '良好人際關係', happinessPoints: 2, monthlyExpenseIncrease: 3000 },
  { id: 'H035', title: '好友們的聚會', description: '好友之間常常會在特殊的節日上，像是生日、節慶等等，安排一些聚會，並互贈一些小禮物。提早為聚會的支出做規劃，對自己的財務計畫會有幫助。抽到卡片的玩家，自由決定是否要在月支出的娛樂欄多增加2,000，來獲得幸福點2點。', category: '良好人際關係', happinessPoints: 2, monthlyExpenseIncrease: 2000 },
  // TODO: verify exact titles for H036–H038
  { id: 'H036', title: '多讀好書', description: '豐富的知識和學識，可以增廣見聞，陶冶心性，在人際交往上，也會給自己帶來自信和成就感。所以養成閱讀的習慣，對自己和人際關係都有幫助。抽到卡片的玩家，自由決定是否要在月支出的教育欄多增加2,000，來獲得幸福點2點。《二、不獲得幸福點2點。', category: '良好人際關係', happinessPoints: 2, monthlyExpenseIncrease: 2000 },
  { id: 'H037', title: '定期的旅遊', description: '讀萬卷書、行萬里路。定期安排一次旅遊，帶著家人或親友一起增廣見聞，看看這個美麗的世界。抽到卡片的玩家，自由決定是否要在月支出的娛樂欄多增加 3,000，來獲得幸福點2點。', category: '良好人際關係', happinessPoints: 2, monthlyExpenseIncrease: 2000 },
  { id: 'H038', title: '得體的服飾', description: '參加各種聚會時，適當的服飾會給他人帶好良好的印象，也帶給自己足夠的自信。不過有些好服飾的價值頗高，提早為得體服飾支出做規劃，對自己的財務計畫會有幫助。抽到卡片的玩家，自由決定是否要在月支出的服飾欄多增加 2,000，來獲得幸福點2點。', category: '良好人際關係', happinessPoints: 2, monthlyExpenseIncrease: 3000 },

  // ─── 幸福的社會（H039–H042）───
  // Monthly expense +2,000, +2 happiness each
  { id: 'H039', title: '擔任義工', description: '這個社會上，有許多需要幫助的人們，需要你伸出援手來幫助他們。你願意盡一己之力，定期到公益機構擔任義工來幫助他人，讓這個社會更幸福。抽到卡片的玩家，自由決定是否要在月支出的其他欄多增加1. 2,000，來獲得幸福點2點。', category: '幸福的社會', happinessPoints: 2, monthlyExpenseIncrease: 2000 },
  { id: 'H040', title: '敬老扶弱', description: '這個社會上，有許多需要幫助的人們，需要你伸出援手來幫助他們。你願意盡一己之力，定期到去敬老院做義工，讓這個社會更幸福。抽到卡片的玩家，自由決定是否要在月支出的其他欄多增加 2,000，來獲得幸福點2點。', category: '幸福的社會', happinessPoints: 2, monthlyExpenseIncrease: 2000 },
  { id: 'H041', title: '急難救助', description: '這個社會上，有許多需要幫助的人們，需要你伸出援手來幫助他們。你願意盡一己之力，為災區人民組織捐款，讓這個社會更幸福。抽到卡片的玩家，自由決定是否要在月支出的其他欄多增加2,000，來獲得幸福點2點。', category: '幸福的社會', happinessPoints: 2, monthlyExpenseIncrease: 2000 },
  { id: 'H042', title: '扶幼濟貧', description: '這個社會上，有許多需要幫助的人們，需要你伸出援手來幫助他們。你願意盡一己之力，定期捐助偏遠山區的失學孩童，讓這個社會更幸福。抽到卡片的玩家，自由決定是否要在月支出的其他欄多增加2,000，來獲得幸福點2點。', category: '幸福的社會', happinessPoints: 2, monthlyExpenseIncrease: 2000 },

  // ─── 幸福家庭重要歷程（H043–H046）───
  // TODO: verify exact titles and costs (same series as H011–H020)
  { id: 'H043', title: '幸福家庭的重要歷程', description: '抽到卡片的玩家，可以自由決定是否依序完成一項歷程，並獲得對應的幸福點（最多只有兩個孩子）。其他玩家也有機會參與，但須先擲骰子，使其大於等於4，才能完成一項歷程。', category: '家庭重要歷程', happinessPoints: 2, otherPlayersCanJoin: true, joinDiceMin: 4 },
  { id: 'H044', title: '幸福家庭的重要歷程', description: '抽到卡片的玩家，可以自由決定是否依序完成一項歷程，並獲得對應的幸福點（最多只有兩個孩子）。其他玩家也有機會參與，但須先擲骰子，使其大於等於4，才能完成一項歷程。', category: '家庭重要歷程', happinessPoints: 2, otherPlayersCanJoin: true, joinDiceMin: 4 },
  { id: 'H045', title: '幸福家庭的重要歷程', description: '抽到卡片的玩家，可以自由決定是否依序完成一項歷程，並獲得對應的幸福點（最多只有兩個孩子）。其他玩家也有機會參與，但須先擲骰子，使其大於等於4，才能完成一項歷程。', category: '家庭重要歷程', happinessPoints: 2, otherPlayersCanJoin: true, joinDiceMin: 4 },
  { id: 'H046', title: '幸福家庭的重要歷程', description: '抽到卡片的玩家，可以自由決定是否依序完成一項歷程，並獲得對應的幸福點（最多只有兩個孩子）。其他玩家也有機會參與，但須先擲骰子，使其大於等於4，才能完成一項歷程。', category: '家庭重要歷程', happinessPoints: 2, otherPlayersCanJoin: true, joinDiceMin: 4 },
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
  category?: string;
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
  // Optional: pay 5,000 → go to school, miss 1 round (no bank pass); roll ≥2 → job +1 level
  { id: 'C001', title: '終身學習一增強職業能力', type: 'ability_profession', description: '你有機會回到學校進修「職業的能力」。\n\n*抽到卡片的玩家，可以自由決定是否接受。\n接受，則直接走到學校格，且停賽一輪。\n若有經過銀行格，無法領取月結餘。\n擲一顆骰子，若點數大於、等於2，則職業等級無條件晉升一級（最高級者無效）。\n不接受，則回收本卡片。', schoolFee: 5000, diceRequirement: 2, abilityEffect: 'profession_level_up', goToSquare: 'school', missRounds: 1, noBankPassThisRound: true },
  { id: 'C002', title: '終身學習一增強職業能力', type: 'ability_profession', description: '你有機會回到學校進修「職業的能力」。\n\n*抽到卡片的玩家，可以自由決定是否接受。\n接受，則直接走到學校格，且停賽一輪。\n若有經過銀行格，無法領取月結餘。\n擲一顆骰子，若點數大於、等於2，則職業等級無條件晉升一級（最高級者無效）。\n不接受，則回收本卡片。', schoolFee: 5000, diceRequirement: 2, abilityEffect: 'profession_level_up', goToSquare: 'school', missRounds: 1, noBankPassThisRound: true },
  { id: 'C003', title: '終身學習一增強職業能力', type: 'ability_profession', description: '你有機會回到學校進修「職業的能力」。\n\n*抽到卡片的玩家，可以自由決定是否接受。\n接受，則直接走到學校格，且停賽一輪。\n若有經過銀行格，無法領取月結餘。\n擲一顆骰子，若點數大於、等於2，則職業等級無條件晉升一級（最高級者無效）。\n不接受，則回收本卡片。', schoolFee: 5000, diceRequirement: 2, abilityEffect: 'profession_level_up', goToSquare: 'school', missRounds: 1, noBankPassThisRound: true },
  { id: 'C004', title: '終身學習一增強職業能力', type: 'ability_profession', description: '你有機會回到學校進修「職業的能力」。\n\n*抽到卡片的玩家，可以自由決定是否接受。\n接受，則直接走到學校格，且停賽一輪。\n若有經過銀行格，無法領取月結餘。\n擲一顆骰子，若點數大於、等於2，則職業等級無條件晉升一級（最高級者無效）。\n不接受，則回收本卡片。', schoolFee: 5000, diceRequirement: 2, abilityEffect: 'profession_level_up', goToSquare: 'school', missRounds: 1, noBankPassThisRound: true },

  // ─── 投資股票的能力（C005–C006）───
  // Optional: pay 10,000 → school, miss 1 round; roll ≥4 → all stock shares ×2
  { id: 'C005', title: '終身學習一投資股票的能力', type: 'ability_stock', description: '你有機會回到學校進修「投資股票的專業知識」。\n\n*抽到卡片的玩家，可以自由決定是否接受。\n接受，則直接走到學校格，且停賽一輪。\n若有經過銀行格，無法領取月結餘。\n擲一顆骰子，若點數大於、等於4，則持有股票的股數全部增加一倍（100%）。\n不接受，則回收本卡片。', schoolFee: 10000, diceRequirement: 4, abilityEffect: 'stock_double', goToSquare: 'school', missRounds: 1, noBankPassThisRound: true },
  { id: 'C006', title: '終身學習一投資股票的能力', type: 'ability_stock', description: '你有機會回到學校進修「投資股票的專業知識」。\n\n*抽到卡片的玩家，可以自由決定是否接受。\n接受，則直接走到學校格，且停賽一輪。\n若有經過銀行格，無法領取月結餘。\n擲一顆骰子，若點數大於、等於4，則持有股票的股數全部增加一倍（100%）。\n不接受，則回收本卡片。', schoolFee: 10000, diceRequirement: 4, abilityEffect: 'stock_double', goToSquare: 'school', missRounds: 1, noBankPassThisRound: true },

  // ─── 投資不動產的能力（C007–C008）───
  // C007: 5,000; C008: 10,000; roll ≥4 → all rental properties rent +10,000
  { id: 'C007', title: '終身學習一投資不動產的能力', type: 'ability_realestate', description: '你有機會回到學校進修「投資不動產的專業知識」。\n\n*抽到卡片的玩家，可以自由決定是否接受。\n接受，則直接走到學校格，且停賽一輪。\n若有經過銀行格，無法領取月結餘。\n擲一顆骰子，若點數大於、等於4，則所有現有與未來供出租不動產的房租收入，全部各增加 10,000。\n不接受，則回收本卡片。', schoolFee: 5000, diceRequirement: 4, abilityEffect: 'rent_plus_10000', goToSquare: 'school', missRounds: 1, noBankPassThisRound: true },
  { id: 'C008', title: '終身學習一投資不動產的能力', type: 'ability_realestate', description: '你有機會回到學校進修「投資不動產的專業知識」。\n\n*抽到卡片的玩家，可以自由決定是否接受。\n接受，則直接走到學校格，且停賽一輪。\n若有經過銀行格，無法領取月結餘。\n擲一顆骰子，若點數大於、等於4，則所有現有與未來供出租不動產的房租收入，全部各增加 10,000。\n不接受，則回收本卡片。', schoolFee: 10000, diceRequirement: 4, abilityEffect: 'rent_plus_10000', goToSquare: 'school', missRounds: 1, noBankPassThisRound: true },

  // ─── 求購單間小套房（C009–C012）───
  // Buyer wants to purchase 1-room suite; seller receives fixed price
  { id: 'C009', title: '求購 單間小套房', type: 'purchase_1room', category: '市場交易', description: '因為推出一系列振興經濟的政策相當成功，帶動整體經濟的成長，產生了許多新的就業機會，形成新一波青年移民潮出現，也造成【單間小套房】需求大增。', purchasePrice: 3000000 },
  { id: 'C010', title: '求購 單間小套房', type: 'purchase_1room', category: '市場交易', description: '因為推出一系列振興經濟的政策相當成功，帶動整體經濟的成長，產生了許多新的就業機會，形成新一波青年移民潮出現，也造成【單間小套房】需求大增。', purchasePrice: 3500000 },
  { id: 'C011', title: '求購 單間小套房', type: 'purchase_1room', category: '市場交易', description: '因為推出一系列振興經濟的政策相當成功，帶動整體經濟的成長，產生了許多新的就業機會，需求大增。形成新一波青年移民潮出現，也造成【單間小套房】', purchasePrice: 4500000 },
  { id: 'C012', title: '求購 單間小套房', type: 'purchase_1room', category: '市場交易', description: '因為推出一系列振興經濟的政策相當成功，帶動整體經濟的成長，產生了許多新的就業機會，形成新一波青年移民潮出現，也造成【單間小套房】需求大增。', purchasePrice: 4000000 },

  // ─── 求購各類型住宅（C013–C016）───
  // % of property total price; seller decides
  { id: 'C013', title: '求購 各類型住宅', type: 'purchase_any_house', category: '市場交易', description: '未來景氣一致看好，吸引大型地產公司進來投資與收購優質的不動產。', purchasePercent: 50 },
  { id: 'C014', title: '求購 各類型住宅', type: 'purchase_any_house', category: '市場交易', description: '未來景氣一致看好，吸引大型地產公司進來投資與收購優質的不動產。', purchasePercent: 60 },
  { id: 'C015', title: '求購 各類型住宅', type: 'purchase_any_house', category: '市場交易', description: '推出新的都市更新政策，吸引大型建設公司前來推動社區開發案。你的住宅位置剛好在開發案中。', purchasePercent: 40 },
  { id: 'C016', title: '求購 各類型住宅', type: 'purchase_any_house', category: '市場交易', description: '未來景氣一致看好，吸引大型地產公司進來投資與收購優質的不動產。', purchasePercent: 70 },

  // ─── 求購兩房一廳/三房兩廳（C017–C022）───
  { id: 'C017', title: 'C017求購 兩房一廳/三房兩廳住宅', type: 'purchase_any_house', category: '市場交易', description: `為了滿足人人有房的目標，推出新的首次購屋優惠政策，帶動兩房一廳/三房兩廳住宅的買氣。
購買者願意以高於房屋總價130% 的價格購買，擁有
兩房一廳/三房兩廳住宅的所有玩家，都可以自由決定是否依此價格出售。`, purchasePercent: 30 },
  { id: 'C018', title: '求購 兩房一廳/三房兩廳住宅', type: 'purchase_any_house', category: '市場交易', description: `吸引人才政策相當成功。鼓勵專業人士移民，推出一系列吸引人才政策，許多專業人士攜家帶眷來定居。購買者願意以高於房屋總價50%的價格購買，擁有兩房一廳/三房兩廳住宅的所有玩家，都可以自由決定是否依此價格出售。`, purchasePercent: 50 },
  { id: 'C019', title: '求購 兩房一廳/三房兩廳住宅', type: 'purchase_any_house', category: '市場交易', description: `為了滿足人人有房的目標，推出新的首次購屋優惠政策，帶動兩房一廳/三房兩廳住宅的買氣。
購買者願意以高於房屋總價35% 的價格購買，擁有兩房一廳/三房兩廳住宅的所有玩家，都可以自由決定是否依此價格出售。`, purchasePercent: 35 },
  { id: 'C020', title: 'C020求購 兩房一廳/三房兩廳住宅', type: 'purchase_any_house', category: '市場交易', description: `為了滿足人人有房的目標，推出新的首次購屋優惠政策，帶動兩房一廳/三房兩廳住宅的買氣。
購買者願意以高於房屋總價60% 的價格購買，擁有兩房一廳/三房兩廳住宅的所有玩家，都可以自由決定是否依此價格出售。`, purchasePercent: 60 },
  { id: 'C021', title: '求購 兩房一廳/三房兩廳住宅', type: 'purchase_any_house', category: '市場交易', description: `為了滿足人人有房的目標，推出新的首次購屋優惠政策，帶動兩房一廳/三房兩廳住宅的買氣。
購買者願意以高於房屋總價40%的價格購買，擁有兩房一廳/三房兩廳住宅的所有玩家，都可以自由決定是否依此價格出售。`, purchasePercent: 40 },
  { id: 'C022', title: '求購 兩房一廳/三房兩廳住宅', type: 'purchase_any_house', category: '市場交易', description: `吸引人才政策相當成功。鼓勵專業人士移民，推出一系列吸引人才政策，許多專業人士攜家帶眷來定居。
購買者願意以高於房屋總價45%的價格購買，擁有兩房一廳/三房兩廳住宅的所有玩家，都可以自由決定是否依此價格出售。`, purchasePercent: 45 },

  // ─── 求購各類型店面（C023–C026）───
  { id: 'C023', title: '求購 各類型店面', type: 'purchase_store', category: '市場交易', description: '景氣提升，商業活動熱絡，造成商用不動產的需求大增。貝購買者願意以高於店面總價 50%的價格購買，擁有各類型店面的所有玩家，都可以自由決定是否依此價格出售。出售後取消其租金收入，仍有房屋貸款者，所得款項須要先行扣除貸款金額。', purchasePercent: 50 },
  { id: 'C024', title: '求購 各類型店面', type: 'purchase_store', category: '市場交易', description: '推出一系列招商政策，吸引外地企業來投資，帶動商用不動產的需求。購買者願意以高於店面總價55%的價格購買，擁有各類型店面的所有玩家，都可以自由決定是否依此價格出售。出售後取消其租金收入，仍有房屋貸款者，所得款項須要先行扣除貸款金額。', purchasePercent: 55 },
  { id: 'C025', title: '求購 各類型店面', type: 'purchase_store', category: '市場交易', description: '景氣提升，商業活動熱絡，造成商用不動產的i需求大增。購買者願意以高於店面總價60%的價格購買，擁有各類型店面的所有玩家，都可以自由決定是否依此價格出售。出售後取消其租金收入，仍有房屋貸款者，所得款項/須要先行扣除貸款金額。', purchasePercent: 60 },
  { id: 'C026', title: '求購 各類型店面', type: 'purchase_store', category: '市場交易', description: '吸推出一系列招商政策，吸引外地企業來推投資，帶動商用不動產的需求。到購購買者願意以高於店面總價45%的價格購買，擁有兩各類型店面的所有玩家，都可以自由決定是否依此價定格出售。出出售後取消其租金收入，仍有房屋貸款者，所得款項須！須要先行扣除貸款金額。', purchasePercent: 45 },

  // ─── 收購獨特的創業點子（C027–C028）───
  // Only for 兼職工作室 (not yet upgraded to 小型企業)
  { id: 'C027', title: '收購 獨特的創業點子', type: 'purchase_startup', category: '企業併購', description: '你擁有的兼職工作室被大型企業看上，願意以3,000,000 的價格，收購你的兼職工作室。擁有兼職工作室的所有玩家（不含已成功晉升為小型企業），都可以自由決定是否要依此價格出售。但是仍有企業貸款者，所得款項須要先行扣除貸款金額。', purchasePrice: 3000000 },
  { id: 'C028', title: '收購 獨特的創業點子', type: 'purchase_startup', category: '企業併購', description: '你擁有的兼職工作室被大型企業看上，願意以5,000,000 的價格，收購你的兼職工作室。擁有兼職工作室的所有玩家（不含已成功晉升為小型企業），都可以自由決定是否要依此價格出售。但是仍有企業貸款者，所得款項須要先行扣除貸款金額。', purchasePrice: 5000000 },

  // ─── 企業併購（C029–C034）───
  // All players may sell any enterprise; price = monthly income × multiplier (minus any loan)
  { id: 'C029', title: '企業併購', type: 'enterprise_acquisition', category: '企業併購', description: `某間跨國的商業集團有意併購你所投資的企業。收購條件為你擁有企業之月收益的60倍為收購價格。
擁有各型企業的所有玩家，都可以自由決定是否依此價格出售。`, acquisitionMultiple: 60 },
  { id: 'C030', title: '企業併購', type: 'enterprise_acquisition', category: '企業併購', description: `某間跨國的商業集團有意併購你所投資的企業。收購條件為你擁有企業之月收益的50倍為收購價格。
擁有各型企業的所有玩家，都可以自由決定是否依此價格出售。`, acquisitionMultiple: 50 },
  { id: 'C031', title: '企業併購', type: 'enterprise_acquisition', category: '企業併購', description: `某間跨國的商業集團有意併購你所投資的企業。收購條件為你擁有企業之月收益的60倍為收購價格。
擁有各型企業的所有玩家，都可以自由決定是否依此價格出售。`, acquisitionMultiple: 60 },
  { id: 'C032', title: '企業併購', type: 'enterprise_acquisition', category: '企業併購', description: `某間跨國的商業集團有意併購你所投資的企業。收購條件為你擁有企業之月收益的50倍為收購價格。擁有各型企業的所有玩家，都可以自由決定是否依此價格出售。`, acquisitionMultiple: 50 },
  { id: 'C033', title: '企業併購', type: 'enterprise_acquisition', category: '企業併購', description: `某間跨國的商業集團有意併購你所投資的企業。收購條件為你擁有企業之月收益的70倍為收購價格。
擁有各型企業的所有玩家，都可以自由決定是否依此價格出售。`, acquisitionMultiple: 60 },
  { id: 'C034', title: '企業併購', type: 'enterprise_acquisition', category: '企業併購', description: `某間跨國的商業集團有意併購你所投資的企業。`, acquisitionMultiple: 70 },

  // ─── 天有不測風雲：醫療類（C035–C037）───
  // Go to hospital, miss 1 round; medical insurance pays 50,000
  { id: 'C035', title: '天有不測風雲', type: 'medical', description: `爆發流感事件！你的運氣不好，感染了新型的病毒，必須住院治療。若有購買醫療保險則可申請理賠。`, cashLoss: 20000, goToSquare: 'hospital', missRounds: 1, insurancePays: 50000 },
  { id: 'C036', title: '天有不測風雲', type: 'medical', description: `食物中毒！你沒有注意飲食安全，不小心食用到不新鮮的食品，造成上吐下瀉，必須住院治療。若有購買醫療保險則可申請理賠。`, cashLoss: 25000, goToSquare: 'hospital', missRounds: 1, insurancePays: 50000 },
  { id: 'C037', title: '天有不測風雲', type: 'medical', description: '發生意外！你運動時不小心跌倒，撞到了頭，被救護車送到了醫院。若有購買醫療保險則可申請理賠。', cashLoss: 20000, goToSquare: 'hospital', missRounds: 1, insurancePays: 50000 },

  // ─── 天有不測風雲：飛行器類（C038–C040）───
  // Only triggers if player owns a 飛行器
  { id: 'C038', title: '天有不測風雲', type: 'aircraft_damage', description: '飛行器被偷！一夜起來，發現你的飛行器被偷了，連忙報案處理。若有買飛行器產物保險則可申請理賠。', cashLoss: 0, happinessLoss: 2, insurancePays: 400000 },
  { id: 'C039', title: '天有不測風雲', type: 'aircraft_damage', description: '發生飛禍！開飛行器時使用通訊工具，未注意飛行安全，不小心撞到路旁的大樹，飛行器嚴重受損。若有買保險則可申請理賠。', cashLoss: 100000, goToSquare: '4s_shop', missRounds: 1, insurancePays: 100000 },
  { id: 'C040', title: '天有不測風雲', type: 'aircraft_damage', description: '發生飛禍！開飛行器時未注意安全距離，不小心撞到前方的飛行器，造成雙方飛行器嚴重受損。若有買保險則可申請理賠。', cashLoss: 200000, insurancePays: 200000 },

  // ─── 天有不測風雲：出租住宅修繕（C041–C043）───
  // Only triggers if player owns rental properties; full insurance on all properties = free
  { id: 'C041', title: '天有不測風雲', type: 'property_repair', description: '發生地震造成出租的房子需要修繕！房客向你反應，房屋的外牆出現裂縫，需要修理。若有房屋保險則由保險支付。', cashLoss: 200000, insurancePays: 200000 },
  { id: 'C042', title: '線路起火', type: 'property_repair', description: '線路起火！出租住宅的管線起火需重新修繕。若有房屋保險則由保險支付。', cashLoss: 100000, insurancePays: 100000 },
  { id: 'C043', title: '天有不測風雲', type: 'property_repair', description: '出租的房子因年久失修需要修繕！房客向你反應，房屋的裝潢需要整修。若有房屋保險則由保險支付。', cashLoss: 150000, insurancePays: 150000 },

  // ─── 財物損失（C044）───
  { id: 'C044', title: '天有不測風雲', type: 'theft', description: '錢包被盜！因為不小心遺失了錢包，需要重新辦理重要證件。', cashLoss: 8000 },

  // ─── 通貨膨脹（C045–C048）───
  // Affects ALL players permanently (monthly expense increase)
  { id: 'C045', title: '通貨膨漲', type: 'inflation', description: '因為種植農作物的成本提高，造成食品價格上漲。', monthlyExpenseChange: 3000, affectsAllPlayers: true },
  { id: 'C046', title: '通貨膨漲', type: 'inflation', description: '因為制衣的原物料成本上漲，造成服飾的價格提升。', monthlyExpenseChange: 2000, affectsAllPlayers: true },
  { id: 'C047', title: '通貨膨漲', type: 'inflation', description: '因為能源礦產的減少，造成油價提升。', monthlyExpenseChange: 2000, affectsAllPlayers: true },
  { id: 'C048', title: '通貨膨漲', type: 'inflation', description: '因為整體物價節節上升，提高了日用品的價格。', monthlyExpenseChange: 1000, affectsAllPlayers: true },

  // ─── 特殊的事件（C049–C056）───
  { id: 'C049', title: '違規闖紅燈', type: 'penalty', description: '違反交通規則。你因為貪圖方便，沒有遵守交通規則，過馬路闖紅燈被拍到。', cashLoss: 2000 },
  { id: 'C050', title: '衝動消費買包包', type: 'penalty', description: '又在亂花錢！？你發現一款新上市的包包，非常喜歡它，衝動地把它買回家（雖然你已經有三個類似的包包了）。', cashLoss: 5000 },
  { id: 'C051', title: '拾金不昧', type: 'reward', description: `拾金不昧。你撿到了一筆錢，交給警察局後，失主為了感謝你，給了你一筆答謝金。`, drawCard: 'happiness' },
  { id: 'C052', title: '遺失鑰匙找鎖匠', type: 'penalty', description: '粗心大意。你不小心遺失了鑰匙，找鎖匠來幫忙開鎖和換鎖。', cashLoss: 3000 },
  { id: 'C053', title: '熱心助人', type: 'reward', description: `熱心助人。你熱心幫助社區清理環境，社區管委會為了感謝你，給你發了一筆獎金。`, drawCard: 'happiness', requiresStorySharing: true },
  { id: 'C054', title: '資源回收', type: 'reward', description: `你開始重視環境保護，開始學習並養成如何回收資源的方法或做法。`, monthlyExpenseChange: -500, requiresStorySharing: true },
  { id: 'C055', title: '奉獻所得', type: 'reward', description: '奉獻所得。你願意每一個月固定捐贈一小筆錢，來幫助需要幫助的人們。', monthlyExpenseChange: 2000, drawCard: 'happiness', affectsAllPlayers: true },
  { id: 'C056', title: '善用時間', type: 'reward', description: `善用時間。
你懂得如何好好運用時間，尤其是懂得如何利用零碎的時間來學習。
抽到本卡的玩家，只要說出一種善用時間的做法或案例，就可以抽取一張新聞卡。`, drawCard: 'news', requiresStorySharing: true },
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
  description?: string;
}

export interface CashDividendNewsCard {
  id: string;
  type: 'cash_dividend';
  subtype: '股市新訊';
  title: string;
  // Total cash = qty(張) × 100 × dividendPerShare
  dividendPerShare: StockSymbolPrices;
  description?: string;
}

export interface StockDividendNewsCard {
  id: string;
  type: 'stock_dividend';
  subtype: '股市新訊';
  title: string;
  // New shares = currentShares × (1 + rate); round up to nearest 張
  dividendRate: StockSymbolPrices;
  description?: string;
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
  description?: string;
}

export interface LargeEnterpriseNewsCard {
  id: string;
  type: 'large_enterprise';
  subtype: '企業新訊';
  title: string;
  businessName: string;
  loanAmount: number;
  maxInvestment: number;            // maximum investment in H
  monthlyReturnPerMillion: number;  // income per 1,000,000 invested
  description?: string;
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
    id: 'N001', type: 'stock_price', subtype: '股市新訊', title: '百年榮景', description: '經濟出現百年榮景，投資熱絡，股市創歷史新高',
    prices: { A10: 8500, A20: 7500, A30: 10500, A40: 12000, B50: 9500, B60: 11000, B70: 16000, B80: 20000 },
  },
  {
    id: 'N002', type: 'stock_price', subtype: '股市新訊', title: '泡沫化大跌', description: '發生嚴重的泡沫化風暴，股市出現恐慌性大跌。',
    prices: { A10: 800, A20: 700, A30: 600, A40: 800, B50: 600, B60: 400, B70: 800, B80: 1000 },
    specialRule: '所有持股數減半，不足1張捨去',
  },
  {
    id: 'N003', type: 'stock_price', subtype: '股市新訊', title: '振興政策大漲', description: '推出振興政策，股市大漲',
    prices: { A10: 6500, A20: 6000, A30: 12000, A40: 9500, B50: 8000, B60: 9500, B70: 12500, B80: 16000 },
  },
  {
    id: 'N004', type: 'stock_price', subtype: '股市新訊', title: '通貨緊縮', description: '連續經濟的衰退，造成通貨緊縮。',
    prices: { A10: 800, A20: 700, A30: 1000, A40: 1500, B50: 1100, B60: 500, B70: 1500, B80: 2000 },
  },
  {
    id: 'N005', type: 'stock_price', subtype: '股市新訊', title: '景氣大好', description: '景氣大好，交易市場熱絡',
    prices: { A10: 6000, A20: 6500, A30: 14000, A40: 8000, B50: 7500, B60: 9000, B70: 12000, B80: 14000 },
  },
  {
    id: 'N006', type: 'stock_price', subtype: '股市新訊', title: '呆帳企業虧損',
    prices: { A10: 1000, A20: 1200, A30: 1000, A40: 1500, B50: 1200, B60: 800, B70: 2000, B80: 1500 },
  },
  {
    id: 'N007', type: 'stock_price', subtype: '股市新訊', title: '新科技', description: '推出新的科技，帶動經濟發展/張',
    prices: { A10: 5500, A20: 6000, A30: 10000, A40: 7500, B50: 7000, B60: 8500, B70: 9500, B80: 13000 },
  },
  {
    id: 'N008', type: 'stock_price', subtype: '股市新訊', title: '傳染病疫情', description: '發生嚴重傳染病疫情，影響經濟發展。',
    prices: { A10: 1100, A20: 1700, A30: 2000, A40: 1200, B50: 1800, B60: 500, B70: 6000, B80: 2500 },
  },
  {
    id: 'N009', type: 'stock_price', subtype: '股市新訊', title: '減稅振興', description: '推出減稅政策，振興股市',
    prices: { A10: 5500, A20: 4500, A30: 9500, A40: 7000, B50: 7000, B60: 7500, B70: 10000, B80: 12500 },
  },
  {
    id: 'N010', type: 'stock_price', subtype: '股市新訊', title: '氣候異常歉收', description: '氣候異常造成海洋洋流暖化，今年農作物大歉收。',
    prices: { A10: 1500, A20: 1500, A30: 2500, A40: 2000, B50: 2200, B60: 1500, B70: 3000, B80: 3500 },
  },
  {
    id: 'N011', type: 'stock_price', subtype: '股市新訊', title: '教育政策', description: '推出教育政策，帶動市場發展',
    prices: { A10: 4500, A20: 4000, A30: 9000, A40: 6500, B50: 8500, B60: 7000, B70: 9500, B80: 11000 },
  },
  {
    id: 'N012', type: 'stock_price', subtype: '股市新訊', title: '提高稅率', description: '修改新稅法，提高稅率。',
    prices: { A10: 2000, A20: 1500, A30: 3000, A40: 2200, B50: 2500, B60: 2200, B70: 2800, B80: 3000 },
  },
  {
    id: 'N013', type: 'stock_price', subtype: '股市新訊', title: '農產豐收', description: '本季農產豐收，農產品交易量大增',
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
    id: 'N016', type: 'stock_price', subtype: '股市新訊', title: '失業率提高', description: '景氣下滑，近三個月失業率提高。',
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
    id: 'N019', type: 'stock_price', subtype: '股市新訊', title: '財政緊縮', description: '財政吃緊，縮減公共建設支出。',
    prices: { A10: 2300, A20: 3000, A30: 2000, A40: 3500, B50: 3000, B60: 4000, B70: 5500, B80: 6500 },
  },
  {
    id: 'N020', type: 'stock_price', subtype: '股市新訊', title: '礦場意外', description: 'NO14【股市新訊】重大工程延誤，新機場工程延誤。',
    prices: { A10: 2500, A20: 3000, A30: 2200, A40: 4000, B50: 3500, B60: 4500, B70: 6000, B80: 7000 },
  },
  {
    id: 'N021', type: 'stock_price', subtype: '股市新訊', title: '景氣溫和',
    prices: { A10: 3500, A20: 4000, A30: 7000, A40: 5000, B50: 5000, B60: 5500, B70: 7500, B80: 8500 },
  },
  {
    id: 'N022', type: 'stock_price', subtype: '股市新訊', title: '鼓勵生育', description: '推出鼓勵生育政策，孩子出生率提高，育兒用品大熱賣。',
    prices: { A10: 6500, A20: 6000, A30: 6000, A40: 4500, B50: 4000, B60: 5000, B70: 6000, B80: 8000 },
  },
  {
    id: 'N023', type: 'stock_price', subtype: '股市新訊', title: '降低銀行利率', description: '為刺激經濟活絡，降低銀行利率。',
    prices: { A10: 3500, A20: 3000, A30: 7000, A40: 5000, B50: 5000, B60: 5000, B70: 7000, B80: 8000 },
  },
  {
    id: 'N024', type: 'stock_price', subtype: '股市新訊', title: '開學季文具',
    prices: { A10: 4500, A20: 6500, A30: 5500, A40: 6000, B50: 9000, B60: 3000, B70: 6000, B80: 8500 },
  },
  {
    id: 'N025', type: 'stock_price', subtype: '股市新訊', title: '大型運動賽事', description: '舉辦大型運動賽事，湧入大批觀光人潮。',
    prices: { A10: 8500, A20: 4500, A30: 6000, A40: 7000, B50: 3000, B60: 7500, B70: 4000, B80: 8000 },
  },
  {
    id: 'N026', type: 'stock_price', subtype: '股市新訊', title: '新能源降運輸成本',
    prices: { A10: 3000, A20: 2500, A30: 6500, A40: 8000, B50: 4000, B60: 4500, B70: 6000, B80: 9500 },
  },

  // ─── 股市新訊：現金股利（N027）───
  // Total cash received = qty(張) × 100 shares × dividendPerShare(H)
  {
    id: 'N027', type: 'cash_dividend', subtype: '股市新訊', title: '股利發放', description: '股利發放。各上市公司發放現金股利。每股發放現金股利',
    dividendPerShare: { A10: 4, A20: 3, A30: 5, A40: 5, B50: 4, B60: 4, B70: 6, B80: 7 },
  },

  // ─── 股市新訊：股票股息（N028）───
  // New total shares = current × (1 + rate); round up any fraction to nearest 張
  {
    id: 'N028', type: 'stock_dividend', subtype: '股市新訊', title: '股息發放', description: '股息發放。各上市公司發放股票股息。每股發放股票股息率',
    dividendRate: { A10: 0.40, A20: 0.30, A30: 0.50, A40: 0.50, B50: 0.40, B60: 0.40, B70: 0.60, B80: 0.70 },
  },

  // ─── 房市新訊（N029–N054）───
  // All players may purchase (drawer has priority); card stays public until bought
  {
    id: 'N029', type: 'real_estate', subtype: '房市新訊', title: '單間小套房出售', description: '新區落成，某建設公司推出新的一房一廳小套房，適合單身或小家庭入住。',
    propertyLabel: '單間小套房', houseType: '1room',
    totalPrice: 1100000, downPayment: 100000, loanAmount: 1000000,
    monthlyPayment: 5000, rent: 6500, netRentIncome: 1500, happinessBonus: 2, canSelfUse: true,
  },
  {
    id: 'N030', type: 'real_estate', subtype: '房市新訊', title: '單間小套房出售', description: '二手單間小套房出售。位置靜幽、交通便利，近中心商城，適合都會新貴入住。',
    propertyLabel: '單間小套房', houseType: '1room',
    totalPrice: 1050000, downPayment: 50000, loanAmount: 1000000,
    monthlyPayment: 5000, rent: 7000, netRentIncome: 2000, happinessBonus: 2, canSelfUse: true,
  },
  {
    id: 'N031', type: 'real_estate', subtype: '房市新訊', title: '單間小套房出售', description: '舊社區一房一廳單間小套房急售。原屋主即將換屋，降價出售。',
    propertyLabel: '單間小套房', houseType: '1room',
    totalPrice: 1000000, downPayment: 100000, loanAmount: 900000,
    monthlyPayment: 4500, rent: 5500, netRentIncome: 1000, happinessBonus: 2, canSelfUse: true,
  },
  {
    id: 'N032', type: 'real_estate', subtype: '房市新訊', title: '舊屋翻新單間小套房', description: '舊屋翻新。屋齡老舊的一房一廳單間小套房，重新裝修出售。周遭生活機能良好，近市集和學校。',
    propertyLabel: '單間小套房', houseType: '1room',
    totalPrice: 1200000, downPayment: 200000, loanAmount: 1000000,
    monthlyPayment: 5000, rent: 5000, netRentIncome: 0, happinessBonus: 2, canSelfUse: true,
  },
  {
    id: 'N033', type: 'real_estate', subtype: '房市新訊', title: '單間小套房出售', description: '精華地段住商兩用房出售。一房一廳單間小套房新建落成，可供居住或個人工作室使用。',
    propertyLabel: '單間小套房', houseType: '1room',
    totalPrice: 1800000, downPayment: 300000, loanAmount: 1500000,
    monthlyPayment: 7500, rent: 10000, netRentIncome: 2500, happinessBonus: 2, canSelfUse: true,
  },
  {
    id: 'N034', type: 'real_estate', subtype: '房市新訊', title: '單間小套房出售', description: '的一房一廳單間小套房。新屋出售。新婚夫妻打算換屋，出售新購作為新人房',
    propertyLabel: '單間小套房', houseType: '1room',
    totalPrice: 1500000, downPayment: 200000, loanAmount: 1300000,
    monthlyPayment: 6500, rent: 7000, netRentIncome: 500, happinessBonus: 2, canSelfUse: true,
  },
  {
    id: 'N035', type: 'real_estate', subtype: '房市新訊', title: '兩房一廳出售', description: '二手新屋出讓。三年內新建住宅兩房一廳出售，內附全新裝潢，立即可入住。',
    propertyLabel: '兩房一廳', houseType: '2room',
    totalPrice: 3000000, downPayment: 600000, loanAmount: 2400000,
    monthlyPayment: 12000, rent: 14000, netRentIncome: 2000, happinessBonus: 4, canSelfUse: true,
  },
  {
    id: 'N036', type: 'real_estate', subtype: '房市新訊', title: '兩房一廳出售', description: '於商業中心附近新落成兩房一廳住宅，適合新婚用新房。',
    propertyLabel: '兩房一廳', houseType: '2room',
    totalPrice: 3600000, downPayment: 600000, loanAmount: 3000000,
    monthlyPayment: 15000, rent: 15000, netRentIncome: 0, happinessBonus: 4, canSelfUse: true,
  },
  {
    id: 'N037', type: 'real_estate', subtype: '房市新訊', title: '兩房一廳出售', description: '老舊住宅出售。原屋主將要退休，計畫將其居住三十年老住宅出讓。',
    propertyLabel: '兩房一廳', houseType: '2room',
    totalPrice: 2000000, downPayment: 200000, loanAmount: 1800000,
    monthlyPayment: 9000, rent: 12000, netRentIncome: 3000, happinessBonus: 4, canSelfUse: true,
  },
  {
    id: 'N038', type: 'real_estate', subtype: '房市新訊', title: '兩房一廳出售',
    propertyLabel: '兩房一廳', houseType: '2room',
    totalPrice: 2800000, downPayment: 300000, loanAmount: 2500000,
    monthlyPayment: 12500, rent: 10000, netRentIncome: -2500, happinessBonus: 4, canSelfUse: true,
  },
  {
    id: 'N039', type: 'real_estate', subtype: '房市新訊', title: '三房兩廳出售', description: '二手新屋出售。三房兩廳住宅出售，近新工商特區，上班輕鬆。',
    propertyLabel: '三房兩廳', houseType: '3room',
    totalPrice: 4500000, downPayment: 500000, loanAmount: 4000000,
    monthlyPayment: 20000, rent: 18000, netRentIncome: -2000, happinessBonus: 6, canSelfUse: true,
  },
  {
    id: 'N040', type: 'real_estate', subtype: '房市新訊', title: '三房兩廳出售', description: '企業發生虧損，將出售三房兩廳主管宿舍變現。',
    propertyLabel: '三房兩廳', houseType: '3room',
    totalPrice: 3500000, downPayment: 300000, loanAmount: 3200000,
    monthlyPayment: 16000, rent: 20000, netRentIncome: 4000, happinessBonus: 6, canSelfUse: true,
  },
  {
    id: 'N041', type: 'real_estate', subtype: '房市新訊', title: '三房兩廳出售', description: '優質三房兩廳住宅落成，位於重要交通要道，交通便利。',
    propertyLabel: '三房兩廳', houseType: '3room',
    totalPrice: 4500000, downPayment: 500000, loanAmount: 4000000,
    monthlyPayment: 20000, rent: 22000, netRentIncome: 2000, happinessBonus: 6, canSelfUse: true,
  },
  {
    id: 'N042', type: 'real_estate', subtype: '房市新訊', title: '三房兩廳出售', description: '新家庭換屋首選。近名校學區，求學便利。',
    propertyLabel: '三房兩廳', houseType: '3room',
    totalPrice: 5000000, downPayment: 500000, loanAmount: 4500000,
    monthlyPayment: 22500, rent: 20000, netRentIncome: -2500, happinessBonus: 6, canSelfUse: true,
  },
  {
    id: 'N043', type: 'real_estate', subtype: '房市新訊', title: '五房三廳豪宅出售', description: '豪華五房三廳豪宅新建落成。企業領導人的最佳選擇。',
    propertyLabel: '五房三廳豪宅', houseType: '5room',
    totalPrice: 15000000, downPayment: 5000000, loanAmount: 10000000,
    monthlyPayment: 50000, rent: 55000, netRentIncome: 5000, happinessBonus: 8, canSelfUse: true,
  },
  {
    id: 'N044', type: 'real_estate', subtype: '房市新訊', title: '五房三廳豪宅出售', description: '振興房市專案。配合經濟振興政策，推出低首付華宅方案，機會難得。',
    propertyLabel: '五房三廳豪宅', houseType: '5room',
    totalPrice: 12000000, downPayment: 1200000, loanAmount: 10800000,
    monthlyPayment: 54000, rent: 50000, netRentIncome: -4000, happinessBonus: 8, canSelfUse: true,
  },
  {
    id: 'N045', type: 'real_estate', subtype: '房市新訊', title: '五房三廳豪宅出售', description: '二手豪宅出售。原屋主計畫移民，欲出讓位於精華區的豪華住宅。',
    propertyLabel: '五房三廳豪宅', houseType: '5room',
    totalPrice: 16000000, downPayment: 5000000, loanAmount: 11000000,
    monthlyPayment: 55000, rent: 55000, netRentIncome: 0, happinessBonus: 8, canSelfUse: true,
  },
  {
    id: 'N046', type: 'real_estate', subtype: '房市新訊', title: '五房三廳豪宅出售', description: '急售求現。因經濟不景氣，造成新一波售屋潮。',
    propertyLabel: '五房三廳豪宅', houseType: '5room',
    totalPrice: 9000000, downPayment: 1000000, loanAmount: 8000000,
    monthlyPayment: 40000, rent: 50000, netRentIncome: 10000, happinessBonus: 8, canSelfUse: true,
  },
  {
    id: 'N047', type: 'real_estate', subtype: '房市新訊', title: '小型店面出售', description: '商業區微型店面求售。',
    propertyLabel: '小型店面', houseType: 'store_small',
    totalPrice: 1200000, downPayment: 120000, loanAmount: 1080000,
    monthlyPayment: 5400, rent: 15000, netRentIncome: 9600, happinessBonus: 0, canSelfUse: false,
  },
  {
    id: 'N048', type: 'real_estate', subtype: '房市新訊', title: '小型店面出售', description: '商業區小型店面求售。',
    propertyLabel: '小型店面', houseType: 'store_small',
    totalPrice: 1800000, downPayment: 180000, loanAmount: 1620000,
    monthlyPayment: 8100, rent: 20000, netRentIncome: 11900, happinessBonus: 0, canSelfUse: false,
  },
  {
    id: 'N049', type: 'real_estate', subtype: '房市新訊', title: '小型店面出售', description: '商業區微型店面求售。',
    propertyLabel: '小型店面', houseType: 'store_small',
    totalPrice: 1000000, downPayment: 80000, loanAmount: 920000,
    monthlyPayment: 4600, rent: 10000, netRentIncome: 5400, happinessBonus: 0, canSelfUse: false,
  },
  {
    id: 'N050', type: 'real_estate', subtype: '房市新訊', title: '商業區小型店面出售', description: '商業區小型店面求售。',
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
    id: 'N052', type: 'real_estate', subtype: '房市新訊', title: '商業區中型店面出售', description: '商業區中型店面求售。',
    propertyLabel: '中型店面', houseType: 'store_medium',
    totalPrice: 6000000, downPayment: 3000000, loanAmount: 3000000,
    monthlyPayment: 15000, rent: 60000, netRentIncome: 45000, happinessBonus: 0, canSelfUse: false,
  },
  {
    id: 'N053', type: 'real_estate', subtype: '房市新訊', title: '大型店面出售', description: '商業區大型店面求售。',
    propertyLabel: '大型店面', houseType: 'store_large',
    totalPrice: 12000000, downPayment: 4000000, loanAmount: 8000000,
    monthlyPayment: 40000, rent: 150000, netRentIncome: 110000, happinessBonus: 0, canSelfUse: false,
  },
  {
    id: 'N054', type: 'real_estate', subtype: '房市新訊', title: '大型店面出售', description: '商業區大型店面求售。',
    propertyLabel: '大型店面', houseType: 'store_large',
    totalPrice: 16000000, downPayment: 6000000, loanAmount: 10000000,
    monthlyPayment: 50000, rent: 200000, netRentIncome: 150000, happinessBonus: 0, canSelfUse: false,
  },

  // ─── 企業新訊：大型企業投資（N055）───
  // All players may participate; invest in multiples of 1,000,000; max 50,000,000
  {
    id: 'N055', type: 'large_enterprise', subtype: '企業新訊', title: '優質大型企業徵求合夥人', description: '知名大型遊樂園將建設新館，計畫徵求合夥投資人。',
    businessName: '遊樂園',
    loanAmount: 0,
    maxInvestment: 50000000,
    monthlyReturnPerMillion: 200000,
  },

  // ─── 企業新訊：兼職工作室貸款（N056–N058）───
  // All players may join; passing bank square and rolling ≥5 upgrades to 小型企業
  // (loan cancelled; monthly income = investmentPoints × 10,000)
  {
    id: 'N056', type: 'small_business', subtype: '企業新訊', title: '創業貸款', description: `最近創業貸款政策推出，每人最多可獲50萬
低利息無擔保創業貸款。

*所有玩家都可以參與*
願意接受的玩家，可獲貸款50萬，但增加貸款利息支出 1,500。且經過銀行時，須擲骰子使其大於等於5。
成功者可以使兼職工作室升等為小型企業，貸款和利息取消，並增加點數1萬倍的企業收入。`,
    loanAmount: 500000, investmentPerMonth: 3000, interestPerMonth: 1500,
  },
  {
    id: 'N057', type: 'small_business', subtype: '企業新訊', title: '創業貸款', description: `最近創業貸款政策推出，每人最多可獲60萬
低利息無擔保創業貸款。

*所有玩家都可以參與*
願意接受的玩家，可獲貸款60萬，但增加貸款利息支出 3,000。且經過銀行時，須擲骰子使其大於等於5。
成功者可以使兼職工作室升等為小型企業，貸款和利息取消，並增加點數1萬倍的企業收入。`,
    loanAmount: 600000, investmentPerMonth: 5000, interestPerMonth: 3000,
  },
  {
    id: 'N058', type: 'small_business', subtype: '企業新訊', title: '創業貸款', description: `最近創業貸款政策推出，每人最多可獲60萬
低利息無擔保創業貸款。

*所有玩家都可以參與*
願意接受的玩家，可獲貸款60萬，但增加貸款利息支出 3,000。且經過銀行時，須擲骰子使其大於等於5。
成功者可以使兼職工作室升等為小型企業，貸款和利息取消，並增加點數1萬倍的企業收入。`,
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
