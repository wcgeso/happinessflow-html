import { describe, expect, it } from 'vitest';
import { HAPPINESS_CARDS, OPPORTUNITY_CARDS } from '../constants/cards';
import { FamilyMilestoneJoinPrompt, GameState, SharedCardPrompt } from '../types';
import { getFamilyMilestoneStageByProgressId } from './familyMilestones';
import { getSharedOpportunityKind, hasIncompleteSharedPrompts, isBoardPromptForCurrentEvent, isBoardPromptVisibleForCurrentEvent, isFamilyMilestoneReadyForSourceCompletion, isFamilyMilestoneSourceDismissal, isForcedBoardCard, resolveBoardCardAction, selectActiveSharedCardPrompt, shouldBlockBoardCardDismissal } from './boardCardActions';

const createGameState = (overrides: Partial<GameState> = {}): GameState => ({
  profession: null,
  selectedEnterprise: null,
  selectedDream: null,
  expenses: {
    taxes: 0,
    mortgage: 0,
    studentLoan: 0,
    creditCard: 0,
    other: 0,
    basicLiving: 0,
    transportEdu: 0,
    otherMedicalChild: 0
  },
  income: {
    salary: 0,
    investment: 0,
    other: 0
  },
  currentRankTitle: '',
  currentRankLevel: 1,
  cash: 5000000,
  children: 0,
  medicalInsuranceCount: 0,
  assets: [],
  liabilities: [],
  loans: 0,
  isSetup: true,
  history: [],
  happiness: [],
  happinessTotal: 0,
  marketPrices: {},
  previousMarketPrices: {},
  lastPublishedCode: '',
  abilities: {
    stockAbilityCount: 0,
    realEstateAbilityCount: 0,
    professionAbilityCount: 0
  },
  completedHappinessEvents: [],
  ...overrides
});

const createFamilyPrompt = (response: FamilyMilestoneJoinPrompt['responses'][string]): FamilyMilestoneJoinPrompt => ({
  id: 'family-prompt-1',
  sourceEventId: 'event-1',
  sourceCardId: 'H011',
  sourcePlayerUid: 'source-player',
  sourcePlayerName: '來源玩家',
  sourceActionCompleted: true,
  requiredRoll: 4,
  targetPlayerUids: ['joining-player'],
  responses: { 'joining-player': response },
  createdAt: 1
});

describe('family milestone shared completion', () => {
  it('keeps a passed roll incomplete until the player chooses whether to join', () => {
    const prompt = createFamilyPrompt({
      playerUid: 'joining-player',
      playerName: '共享玩家',
      status: 'passed',
      actionCompleted: false,
      roll: 5,
      respondedAt: 2
    });

    expect(hasIncompleteSharedPrompts({ familyMilestoneJoinPrompt: prompt, sharedCardPrompt: null })).toBe(true);

    prompt.responses['joining-player'].actionCompleted = true;
    expect(hasIncompleteSharedPrompts({ familyMilestoneJoinPrompt: prompt, sharedCardPrompt: null })).toBe(false);
  });

  it('treats failed and declined rolls as completed responses', () => {
    const failedPrompt = createFamilyPrompt({
      playerUid: 'joining-player',
      playerName: '共享玩家',
      status: 'failed',
      roll: 2,
      respondedAt: 2
    });
    const declinedPrompt = createFamilyPrompt({
      playerUid: 'joining-player',
      playerName: '共享玩家',
      status: 'declined',
      respondedAt: 2
    });

    expect(hasIncompleteSharedPrompts({ familyMilestoneJoinPrompt: failedPrompt, sharedCardPrompt: null })).toBe(false);
    expect(hasIncompleteSharedPrompts({ familyMilestoneJoinPrompt: declinedPrompt, sharedCardPrompt: null })).toBe(false);
  });

  it('keeps the family prompt open until the shared dice presentation is ready', () => {
    const prompt = createFamilyPrompt({
      playerUid: 'joining-player',
      playerName: '共享玩家',
      status: 'failed',
      actionCompleted: true,
      roll: 2,
      respondedAt: Date.now(),
      presentationReadyAt: Date.now() + 10_000
    });

    expect(hasIncompleteSharedPrompts({ familyMilestoneJoinPrompt: prompt, sharedCardPrompt: null })).toBe(true);
    prompt.responses['joining-player'].presentationReadyAt = Date.now() - 1;
    expect(hasIncompleteSharedPrompts({ familyMilestoneJoinPrompt: prompt, sharedCardPrompt: null })).toBe(false);
  });

  it('keeps the source action incomplete until the source player finishes it', () => {
    const prompt = {
      ...createFamilyPrompt({
        playerUid: 'joining-player',
        playerName: '共享玩家',
        status: 'failed',
        roll: 2,
        respondedAt: 2
      }),
      sourceActionCompleted: false
    };

    expect(hasIncompleteSharedPrompts({ familyMilestoneJoinPrompt: prompt, sharedCardPrompt: null })).toBe(true);
    prompt.sourceActionCompleted = true;
    expect(hasIncompleteSharedPrompts({ familyMilestoneJoinPrompt: prompt, sharedCardPrompt: null })).toBe(false);
  });

  it('allows the source to auto-complete an active family prompt after every action is complete', () => {
    const prompt = createFamilyPrompt({
      playerUid: 'joining-player',
      playerName: '共享玩家',
      status: 'failed',
      roll: 2,
      respondedAt: 2
    });
    const boardState = {
      currentEvent: { id: 'event-1', playerUid: 'source-player' },
      currentCard: { cardId: 'H011' },
      familyMilestoneJoinPrompt: prompt,
      sharedCardPrompt: null
    } as any;

    expect(isFamilyMilestoneReadyForSourceCompletion(boardState, 'source-player')).toBe(true);
  });

  it('does not auto-complete while a passed player still has a pending action', () => {
    const prompt = createFamilyPrompt({
      playerUid: 'joining-player',
      playerName: '共享玩家',
      status: 'passed',
      actionCompleted: false,
      roll: 5,
      respondedAt: 2
    });
    const boardState = {
      currentEvent: { id: 'event-1', playerUid: 'source-player' },
      currentCard: { cardId: 'H011' },
      familyMilestoneJoinPrompt: prompt,
      sharedCardPrompt: null
    } as any;

    expect(isFamilyMilestoneReadyForSourceCompletion(boardState, 'source-player')).toBe(false);
  });

  it('does not auto-complete a stale prompt or from a non-source player', () => {
    const prompt = createFamilyPrompt({
      playerUid: 'joining-player',
      playerName: '共享玩家',
      status: 'failed',
      roll: 2,
      respondedAt: 2
    });
    const staleBoard = {
      currentEvent: { id: 'event-2', playerUid: 'source-player' },
      currentCard: { cardId: 'H012' },
      familyMilestoneJoinPrompt: prompt,
      sharedCardPrompt: null
    } as any;

    expect(isFamilyMilestoneReadyForSourceCompletion(staleBoard, 'source-player')).toBe(false);
    expect(isFamilyMilestoneReadyForSourceCompletion({
      ...staleBoard,
      currentEvent: { id: 'event-1', playerUid: 'source-player' },
      currentCard: { cardId: 'H011' }
    }, 'joining-player')).toBe(false);
  });

  it('keeps each player on their own sequential family stage', () => {
    const sourceState = createGameState({ completedHappinessEvents: ['date'] });
    const participantState = createGameState();
    const sourceStage = getFamilyMilestoneStageByProgressId('propose');
    const participantStage = getFamilyMilestoneStageByProgressId('date');

    const sourceAction = resolveBoardCardAction('H016', sourceState, sourceStage);
    const participantAction = resolveBoardCardAction('H016', participantState, participantStage);

    expect(sourceAction.kind).toBe('choice');
    expect(participantAction.kind).toBe('choice');
    if (sourceAction.kind !== 'choice' || participantAction.kind !== 'choice') return;

    const sourceAccept = sourceAction.options.find(option => option.id === 'accept')?.action;
    const participantAccept = participantAction.options.find(option => option.id === 'accept')?.action;
    expect(sourceAccept.kind).toBe('financial');
    expect(participantAccept.kind).toBe('financial');
    if (sourceAccept.kind !== 'financial' || participantAccept.kind !== 'financial') return;

    expect(sourceAccept.txData.happinessEventPayload?.progressId).toBe('propose');
    expect(participantAccept.txData.happinessEventPayload?.progressId).toBe('date');
  });

  it('does not expose another family stage after all five stages are complete', () => {
    const completedState = createGameState({
      completedHappinessEvents: ['date', 'propose', 'wedding', 'child1', 'child2']
    });

    expect(getFamilyMilestoneStageByProgressId('child2')).not.toBeNull();
    const action = resolveBoardCardAction('H016', completedState);
    if (action.kind !== 'choice') return;
    expect(action.options.find(option => option.id === 'reject')?.action.kind).toBe('dismiss');
    expect(action.options.find(option => option.id === 'accept')).toBeUndefined();
  });

  it('ignores a prompt whose event or card no longer matches the current board event', () => {
    const prompt = createFamilyPrompt({
      playerUid: 'joining-player',
      playerName: '共享玩家',
      status: 'passed',
      actionCompleted: false,
      roll: 5,
      respondedAt: 2
    });
    const staleBoard = {
      currentEvent: { id: 'event-2' },
      currentCard: { cardId: 'H012' },
      familyMilestoneJoinPrompt: prompt,
      sharedCardPrompt: null
    } as any;

    expect(isBoardPromptForCurrentEvent(prompt, staleBoard)).toBe(false);
    expect(hasIncompleteSharedPrompts(staleBoard)).toBe(false);
  });

  it('shows a prompt without requiring the source card projection', () => {
    const prompt = { sourceEventId: 'event-1', sourceCardId: 'N027' };

    expect(isBoardPromptVisibleForCurrentEvent(prompt, { currentEvent: { id: 'event-1' } })).toBe(true);
    expect(isBoardPromptVisibleForCurrentEvent(prompt, { currentEvent: { id: 'event-2' } })).toBe(false);
  });

  it('allows only the source player to dismiss their active family milestone prompt', () => {
    const prompt = {
      ...createFamilyPrompt({
        playerUid: 'joining-player',
        playerName: '共享玩家',
        status: 'declined',
        respondedAt: 2
      }),
      sourceCardId: 'H012'
    };
    const boardState = { familyMilestoneJoinPrompt: prompt, sharedCardPrompt: null };

    expect(isFamilyMilestoneSourceDismissal(boardState, 'event-1', 'H012', 'source-player')).toBe(true);
    expect(isFamilyMilestoneSourceDismissal(boardState, 'event-1', 'H012', 'joining-player')).toBe(false);
  });

  it('blocks the source from dismissing H016 before the join flow completes', () => {
    const prompt = {
      ...createFamilyPrompt({
        playerUid: 'joining-player',
        playerName: '共享玩家',
        status: 'passed',
        actionCompleted: false,
        roll: 5,
        respondedAt: 2
      }),
      sourceCardId: 'H016'
    };
    const boardState = { familyMilestoneJoinPrompt: prompt, sharedCardPrompt: null };

    expect(shouldBlockBoardCardDismissal(boardState, 'event-1', 'H016', 'source-player', true)).toBe(true);
    expect(shouldBlockBoardCardDismissal(boardState, 'event-1', 'H016', 'source-player', false)).toBe(true);
    expect(shouldBlockBoardCardDismissal(boardState, 'event-1', 'H016', 'joining-player', true)).toBe(true);
  });

  it('routes every family milestone card through the same shared choice flow', () => {
    const familyCards = HAPPINESS_CARDS.filter(card => card.category === '家庭重要歷程');

    expect(familyCards).toHaveLength(14);
    familyCards.forEach(card => {
      expect(card.otherPlayersCanJoin, card.id).toBe(true);
      expect(resolveBoardCardAction(card.id, createGameState()).kind, card.id).toBe('choice');
    });
  });
});

describe('remote prompt authority', () => {
  it('does not let a stale local snapshot overwrite remote responses', () => {
    const remote: SharedCardPrompt = {
      id: 'shared-1',
      kind: 'startup_loan',
      sourceEventId: 'event-1',
      sourceCardId: 'N057',
      sourcePlayerUid: 'source-player',
      sourcePlayerName: '來源玩家',
      targetPlayerUids: ['joining-player'],
      responses: {
        'joining-player': {
          playerUid: 'joining-player',
          playerName: '共享玩家',
          status: 'completed',
          respondedAt: 2
        }
      },
      createdAt: 1
    };
    const stale = { ...remote, responses: {} };

    expect(selectActiveSharedCardPrompt(remote, stale)?.responses).toEqual(remote.responses);
  });
});

describe('resolveBoardCardAction', () => {
  it('keeps the source stage fixed while a family event waits for other players', () => {
    const action = resolveBoardCardAction(
      'H016',
      createGameState({ completedHappinessEvents: ['date'] }),
      getFamilyMilestoneStageByProgressId('date')
    );

    expect(action.kind).toBe('choice');
    if (action.kind !== 'choice') return;
    const acceptOption = action.options.find(option => option.id === 'accept');
    expect(acceptOption?.action.kind).toBe('financial');
    if (acceptOption?.action.kind === 'financial') {
      expect(acceptOption.action.txData.happinessEventPayload?.progressId).toBe('date');
    }
  });

  it('C042: no house means no payment flow', () => {
    const action = resolveBoardCardAction('C042', createGameState());
    expect(action.kind).toBe('choice');
    if (action.kind !== 'choice') return;
    expect(action.options).toHaveLength(1);
    expect(action.options[0].action.kind).toBe('dismiss');
  });

  it('C038 removes the vehicle and shows insurance cash as one financial action', () => {
    const action = resolveBoardCardAction('C038', createGameState({
      assets: [{
        id: 'car-1', name: '汽車', cost: 600000, downPayment: 120000,
        cashflow: 0, type: '汽車', isInsured: true
      }]
    }));

    expect(action.kind).toBe('financial');
    if (action.kind !== 'financial') return;
    expect(action.txData.boardFlow).toBe('vehicle-loss');
    expect(action.txData.vehicleLossPayload?.assetId).toBe('car-1');
    expect(action.txData.cashChange).toBe(400000);
    expect(action.expectedEntries).toEqual([
      { category: 'Assets', name: '汽車', direction: 'Decrease' },
      { category: 'Assets', name: '現金', direction: 'Increase' }
    ]);
  });

  it('C038 keeps the vehicle-loss transaction atomic without insurance cash', () => {
    const action = resolveBoardCardAction('C038', createGameState({
      assets: [{
        id: 'car-1', name: '汽車', cost: 600000, downPayment: 120000,
        cashflow: 0, type: '汽車'
      }]
    }));

    expect(action.kind).toBe('financial');
    if (action.kind !== 'financial') return;
    expect(action.txData.boardFlow).toBe('vehicle-loss');
    expect(action.txData.cashChange).toBe(0);
    expect(action.expectedEntries).toEqual([
      { category: 'Assets', name: '汽車', direction: 'Decrease' }
    ]);
  });

  it('C042: insured house skips payment', () => {
    const action = resolveBoardCardAction('C042', createGameState({
      assets: [{
        id: 'house-1',
        name: 'N001 單間小套房',
        cost: 1000000,
        downPayment: 300000,
        cashflow: 10000,
        type: '不動產',
        isInsured: true
      }]
    }));
    expect(action.kind).toBe('choice');
  });

  it('C042: uninsured house enters financial flow', () => {
    const action = resolveBoardCardAction('C042', createGameState({
      assets: [{
        id: 'house-1',
        name: 'N001 單間小套房',
        cost: 1000000,
        downPayment: 300000,
        cashflow: 10000,
        type: '不動產'
      }]
    }));
    expect(action.kind).toBe('financial');
    if (action.kind !== 'financial') return;
    expect(action.txData.cashChange).toBe(-100000);
  });

  it('property repair charges the card amount once when any house is uninsured', () => {
    const action = resolveBoardCardAction('C043', createGameState({
      assets: [
        {
          id: 'house-1',
          name: 'N001 單間小套房',
          cost: 1000000,
          downPayment: 300000,
          cashflow: 10000,
          type: '不動產',
          isSelfUse: true
        },
        {
          id: 'house-2',
          name: 'N002 兩房一廳',
          cost: 2000000,
          downPayment: 600000,
          cashflow: 20000,
          type: '不動產',
          isSelfUse: false
        }
      ]
    }));

    expect(action.kind).toBe('financial');
    if (action.kind !== 'financial') return;
    expect(action.txData.amount).toBe(300000);
    expect(action.txData.impacts).toContain('未投保房屋 2 間，每間修繕費 150,000');
  });

  it.each([
    ['C041', 400000],
    ['C042', 200000],
    ['C043', 300000]
  ])('%s charges each uninsured house repair fee', (cardId, fee) => {
    const action = resolveBoardCardAction(cardId, createGameState({
      assets: [
        { id: 'house-1', name: '出租房 1', cost: 1000000, downPayment: 300000, cashflow: 10000, type: '不動產' },
        { id: 'house-2', name: '出租房 2', cost: 1000000, downPayment: 300000, cashflow: 10000, type: '不動產' }
      ]
    }));

    expect(action.kind).toBe('financial');
    if (action.kind !== 'financial') return;
    expect(action.txData.cashChange).toBe(-fee);
  });

  it('C041 charges 600,000 for three uninsured houses', () => {
    const action = resolveBoardCardAction('C041', createGameState({
      assets: [
        { id: 'house-1', name: '出租房 1', cost: 1000000, type: '不動產' },
        { id: 'house-2', name: '出租房 2', cost: 1000000, type: '不動產' },
        { id: 'house-3', name: '出租房 3', cost: 1000000, type: '不動產' }
      ]
    }));

    expect(action.kind).toBe('financial');
    if (action.kind !== 'financial') return;
    expect(action.txData.amount).toBe(600000);
    expect(action.txData.cashChange).toBe(-600000);
  });

  it.each([
    ['C035', 20000],
    ['C036', 25000],
    ['C037', 20000]
  ])('%s keeps medical payment separate from the insurance claim', (cardId, medicalFee) => {
    const action = resolveBoardCardAction(cardId, createGameState({ medicalInsuranceCount: 1 }));

    expect(action.kind).toBe('financial');
    if (action.kind !== 'financial') return;
    expect(action.txData.cashChange).toBe(-medicalFee);
    expect(action.note).toContain('醫療理賠按鈕');
  });

  it('C040 pays no cash when the vehicle is insured', () => {
    const action = resolveBoardCardAction('C040', createGameState({
      assets: [{
        id: 'car-1', name: '汽車', cost: 600000, downPayment: 120000,
        cashflow: 0, type: '汽車', isInsured: true
      }]
    }));

    expect(action.kind).toBe('choice');
    if (action.kind !== 'choice') return;
    expect(action.options[0]?.action.kind).toBe('dismiss');
  });

  it('C040 charges the fixed repair fee when the vehicle is uninsured', () => {
    const action = resolveBoardCardAction('C040', createGameState({
      assets: [{
        id: 'car-1', name: '汽車', cost: 600000, downPayment: 120000,
        cashflow: 0, type: '汽車'
      }]
    }));

    expect(action.kind).toBe('financial');
    if (action.kind !== 'financial') return;
    expect(action.txData.cashChange).toBe(-200000);
  });

  it.each(['C041', 'C042', 'C043'])('%s waives repair payment when every house is insured', cardId => {
    const action = resolveBoardCardAction(cardId, createGameState({
      assets: [{
        id: 'house-1', name: '出租房', cost: 1000000, downPayment: 300000,
        cashflow: 10000, type: '不動產', isInsured: true
      }]
    }));

    expect(action.kind).toBe('choice');
    if (action.kind !== 'choice') return;
    expect(action.options[0]?.action.kind).toBe('dismiss');
  });

  it('C014 offers every qualifying residence at a 60% premium', () => {
    const action = resolveBoardCardAction('C014', createGameState({
      assets: [{
        id: 'house-1',
        name: 'N001 單間小套房',
        cost: 10000000,
        downPayment: 3000000,
        cashflow: 30000,
        type: '不動產'
      }]
    }));

    expect(action.kind).toBe('asset_sale');
    if (action.kind !== 'asset_sale') return;
    expect(action.items[0]?.price).toBe(16000000);
  });

  it('C014 has no sale candidates when the player owns no residence', () => {
    const action = resolveBoardCardAction('C014', createGameState());
    expect(action.kind).toBe('asset_sale');
    if (action.kind !== 'asset_sale') return;
    expect(action.items).toHaveLength(0);
  });

  it('C011 offers an owned single-room apartment at the fixed purchase price', () => {
    const action = resolveBoardCardAction('C011', createGameState({
      assets: [{
        id: 'house-1',
        name: 'N029 單間小套房',
        cost: 1100000,
        downPayment: 100000,
        cashflow: 1500,
        type: '不動產'
      }]
    }));
    expect(action.kind).toBe('asset_sale');
    if (action.kind !== 'asset_sale') return;
    expect(action.items[0]?.price).toBe(4500000);
  });

  it('C011 is classified as a shared asset-sale event from card data', () => {
    expect(getSharedOpportunityKind('C011')).toBe('asset_sale');
  });

  it.each([
    ['C023', 50, 1500000],
    ['C024', 55, 1550000],
    ['C025', 60, 1600000],
    ['C026', 45, 1450000]
  ])('%s pays the store premium instead of a fraction of the total price', (cardId, _percent, expectedPrice) => {
    const action = resolveBoardCardAction(cardId, createGameState({
      assets: [{
        id: 'store-1',
        name: '店面資產',
        cost: 1000000,
        downPayment: 300000,
        cashflow: 10000,
        type: '不動產',
        houseType: 'store'
      }]
    }));

    expect(action.kind).toBe('asset_sale');
    if (action.kind !== 'asset_sale') return;
    expect(action.items[0]?.price).toBe(expectedPrice);
  });

  it('classifies every purchase card as a shared asset-sale event', () => {
    const purchaseTypes = new Set([
      'purchase_1room',
      'purchase_any_house',
      'purchase_store',
      'purchase_startup',
      'enterprise_acquisition'
    ]);
    const purchaseCards = OPPORTUNITY_CARDS.filter(card => purchaseTypes.has(card.type));

    expect(purchaseCards).toHaveLength(26);
    purchaseCards.forEach(card => {
      expect(getSharedOpportunityKind(card.id), card.id).toBe('asset_sale');
      expect(resolveBoardCardAction(card.id, createGameState()).kind, card.id).toBe('asset_sale');
    });
  });

  it('uses a new shared prompt instead of a stale local snapshot', () => {
    const current = { id: 'event_C014_shared' } as SharedCardPrompt;
    const stale = { id: 'old_shared' } as SharedCardPrompt;

    expect(selectActiveSharedCardPrompt(current, stale)).toBe(current);
  });

  it('C034 tolerates legacy enterprise assets without cashflow', () => {
    const action = resolveBoardCardAction('C034', createGameState({
      liabilities: undefined as unknown as GameState['liabilities'],
      assets: [{
        id: 'business-legacy',
        name: '舊企業資產',
        cost: 1000000,
        downPayment: 1000000,
        cashflow: undefined as unknown as number,
        type: '企業'
      }]
    }));

    expect(action.kind).toBe('asset_sale');
    if (action.kind !== 'asset_sale') return;
    expect(action.items[0]?.price).toBe(0);
  });

  it('C039: no vehicle means no payment flow', () => {
    const action = resolveBoardCardAction('C039', createGameState());
    expect(action.kind).toBe('choice');
  });

  it('C039: insured vehicle skips payment', () => {
    const action = resolveBoardCardAction('C039', createGameState({
      assets: [{
        id: 'car-1',
        name: '汽車',
        cost: 600000,
        downPayment: 120000,
        cashflow: 0,
        type: '汽車',
        isInsured: true
      }]
    }));
    expect(action.kind).toBe('effect');
    if (action.kind !== 'effect') return;
    expect(action.afterApply?.moveToSquare).toEqual(expect.objectContaining({
      squareType: 'repair',
      skipTurns: 1,
    }));
  });

  it('C039: legacy aircraft also counts as vehicle ownership', () => {
    const action = resolveBoardCardAction('C039', createGameState({
      assets: [{
        id: 'car-legacy',
        name: '飛行器',
        cost: 600000,
        downPayment: 120000,
        cashflow: 0,
        type: '飛行器'
      }]
    }));
    expect(action.kind).toBe('financial');
    if (action.kind !== 'financial') return;
    expect(action.txData.cashChange).toBe(-100000);
    expect(action.afterApply?.moveToSquare).toEqual(expect.objectContaining({
      squareType: 'repair',
      skipTurns: 1,
    }));
  });

  it('C035 moves the player to hospital and pauses one turn after payment', () => {
    const action = resolveBoardCardAction('C035', createGameState());

    expect(action.kind).toBe('financial');
    if (action.kind !== 'financial') return;
    expect(action.afterApply?.moveToSquare).toEqual(expect.objectContaining({
      squareType: 'hospital',
      skipTurns: 1,
    }));
  });

  it('C048 keeps shared expense effect for all players', () => {
    const action = resolveBoardCardAction('C048', createGameState());
    expect(action.kind).toBe('financial');
    if (action.kind !== 'financial') return;
    expect(action.afterApply?.affectsAllPlayersExpense).toEqual({
      amount: 1000,
      category: 'basicLiving',
      isIncrease: true
    });
  });

  it('C047 maps inflation to the transport expense category', () => {
    const action = resolveBoardCardAction('C047', createGameState());
    expect(action.kind).toBe('financial');
    if (action.kind !== 'financial') return;
    expect(action.txData.expensePayload).toEqual({
      category: 'transportEdu',
      amount: 2000,
      isIncrease: true
    });
    expect(action.afterApply?.affectsAllPlayersExpense).toEqual({
      amount: 2000,
      category: 'transportEdu',
      isIncrease: true
    });
  });

  it('C055 uses otherMedicalChild expense category', () => {
    const action = resolveBoardCardAction('C055', createGameState());
    expect(action.kind).toBe('choice');
    if (action.kind !== 'choice') return;
    const acceptOption = action.options.find(option => option.id === 'accept');
    expect(acceptOption?.action.kind).toBe('financial');
    if (!acceptOption || acceptOption.action.kind !== 'financial') return;
    expect(acceptOption.action.txData.expensePayload).toEqual({
      category: 'otherMedicalChild',
      amount: 2000,
      isIncrease: true
    });
  });

  it('C054 requires accept before expense reduction', () => {
    const action = resolveBoardCardAction('C054', createGameState());
    expect(action.kind).toBe('choice');
    if (action.kind !== 'choice') return;
    const acceptOption = action.options.find(option => option.id === 'accept');
    expect(acceptOption?.action.kind).toBe('financial');
    if (!acceptOption || acceptOption.action.kind !== 'financial') return;
    expect(acceptOption.action.txData.expensePayload).toEqual({
      category: 'otherMedicalChild',
      amount: 500,
      isIncrease: false
    });
  });

  it('H026 without children only offers close', () => {
    const action = resolveBoardCardAction('H026', createGameState({ children: 0 }));
    expect(action.kind).toBe('choice');
    if (action.kind !== 'choice') return;
    expect(action.options).toHaveLength(1);
    expect(action.options[0]).toMatchObject({
      id: 'dismiss',
      label: '關閉',
      action: { kind: 'dismiss' }
    });
  });

  it('H026 with a child keeps the accept flow', () => {
    const action = resolveBoardCardAction('H026', createGameState({ children: 1 }));
    expect(action.kind).toBe('choice');
    if (action.kind !== 'choice') return;
    expect(action.options.map(option => option.id)).toEqual(['accept', 'reject']);
    expect(action.options[0]?.action.kind).toBe('financial');
  });

  it('H026 keeps the accept flow when the child milestone is checked', () => {
    const action = resolveBoardCardAction('H026', createGameState({
      happiness: [{ id: 'h_child1', label: '擁有第一個孩子', points: 4, checked: true }]
    }));
    expect(action.kind).toBe('choice');
    if (action.kind !== 'choice') return;
    expect(action.options.map(option => option.id)).toEqual(['accept', 'reject']);
  });

  it('N055 creates investment input flow', () => {
    const action = resolveBoardCardAction('N055', createGameState());
    expect(action.kind).toBe('investment');
    if (action.kind !== 'investment') return;
    expect(action.minAmount).toBe(1000000);
    expect(action.maxAmount).toBe(50000000);
    expect(action.monthlyReturnPerStep).toBe(200000);
  });

  it('N057 uses investment amount as startup asset value, not loan amount', () => {
    const action = resolveBoardCardAction('N057', createGameState());
    expect(action.kind).toBe('financial');
    if (action.kind !== 'financial') return;
    expect(action.txData.amount).toBe(5000);
    expect(action.txData.cashChange).toBe(595000);
    expect(action.txData.assetDetails).toMatchObject({
      type: '企業',
      downPayment: 5000,
      loanAmount: 600000,
      loanInterest: 3000,
      symbol: 'N057'
    });
    expect(action.txData.impacts).toEqual([
      '現金 -5,000',
      '現金（企業貸款） +600,000',
      'N057 兼職工作室 +5,000',
      '企業貸款 +600,000',
      '企業貸款利息(月) +3,000'
    ]);
    expect(action.expectedEntries).toEqual([
      { category: 'Assets', name: '現金', direction: 'Decrease' },
      { category: 'Assets', name: '現金（企業貸款）', direction: 'Increase' },
      { category: 'Assets', name: 'N057 兼職工作室', direction: 'Increase' },
      { category: 'Liabilities', name: '企業貸款', direction: 'Increase' },
      { category: 'Expenses', name: '企業貸款利息', direction: 'Increase' }
    ]);
  });

  it('N056 and N058 follow the same startup loan structure', () => {
    const n056 = resolveBoardCardAction('N056', createGameState());
    const n058 = resolveBoardCardAction('N058', createGameState());

    expect(n056.kind).toBe('financial');
    expect(n058.kind).toBe('financial');

    if (n056.kind !== 'financial' || n058.kind !== 'financial') return;

    expect(n056.txData.assetDetails).toMatchObject({
      downPayment: 3000,
      loanAmount: 500000,
      loanInterest: 1500,
      symbol: 'N056'
    });
    expect(n058.txData.assetDetails).toMatchObject({
      downPayment: 5000,
      loanAmount: 600000,
      loanInterest: 3000,
      symbol: 'N058'
    });
  });

  it('C051 directly enters happiness follow-up flow', () => {
    const action = resolveBoardCardAction('C051', createGameState());
    expect(action.kind).toBe('effect');
    if (action.kind !== 'effect') return;
    expect(action.afterApply?.drawCard).toBe('happiness');
  });

  it('C053 directly enters happiness follow-up flow', () => {
    const action = resolveBoardCardAction('C053', createGameState());
    expect(action.kind).toBe('effect');
    if (action.kind !== 'effect') return;
    expect(action.afterApply?.drawCard).toBe('happiness');
  });

  it('C056 requires accept before news follow-up', () => {
    const action = resolveBoardCardAction('C056', createGameState());
    expect(action.kind).toBe('choice');
    if (action.kind !== 'choice') return;
    const acceptOption = action.options.find(option => option.id === 'accept');
    expect(acceptOption?.action.kind).toBe('effect');
    if (!acceptOption || acceptOption.action.kind !== 'effect') return;
    expect(acceptOption.action.afterApply?.drawCard).toBe('news');
  });

  it('H009 requires story approval before awarding happiness', () => {
    const action = resolveBoardCardAction('H009', createGameState());
    expect(action.kind).toBe('happiness');
    if (action.kind !== 'happiness') return;
    expect(action.points).toBe(2);
  });

  it('C051 and C053 are forced board cards', () => {
    expect(isForcedBoardCard('C051')).toBe(true);
    expect(isForcedBoardCard('C053')).toBe(true);
  });
});

describe('H027 requires the first date', () => {
  it('has no effect before the first date is completed', () => {
    const action = resolveBoardCardAction('H027', createGameState());
    expect(action.kind).toBe('choice');
    if (action.kind !== 'choice') return;
    expect(action.options.map(option => option.id)).toEqual(['dismiss']);
  });

  it('offers the surprise once the first date is completed', () => {
    const action = resolveBoardCardAction('H027', createGameState({ completedHappinessEvents: ['date'] }));
    expect(action.kind).toBe('choice');
    if (action.kind !== 'choice') return;
    expect(action.options.map(option => option.id)).toContain('accept');
  });
});
