import type {Room,GameState,BoardDeckState,BoardCardResult,BoardEventLog,BoardQueuedEvent,BoardSquareType} from '../../types';
import {getSquareByIndex,BOARD_SQUARES} from '../../constants/board';
import {buildHappinessCardMetaFromSchema,buildNewsCardMetaFromSchema,buildOpportunityCardMetaFromSchema} from '../../constants/cards';
import {cleanObject} from '../../utils/utils';
import {activateBoardQueueEntry,appendBoardCardLog} from './eventQueue';
import {buildMovementEffects} from './movementEffects';
const buildHappinessCardMeta = (cardId: string, playerState?: GameState | null) => {
    return buildHappinessCardMetaFromSchema(cardId, playerState);
};

const buildOpportunityCardMeta = (cardId: string) => {
    return buildOpportunityCardMetaFromSchema(cardId);
};

const buildNewsCardMeta = (cardId: string) => {
    return buildNewsCardMetaFromSchema(cardId);
};

export const buildBoardCardResultById = (cardId: string, playerState?: GameState | null): BoardCardResult | null => {
    const meta = cardId.startsWith('H')
        ? buildHappinessCardMeta(cardId, playerState)
        : cardId.startsWith('C')
            ? buildOpportunityCardMeta(cardId)
            : cardId.startsWith('N')
                ? buildNewsCardMeta(cardId)
                : null;
    if (!meta) return null;

    return {
        deck: meta.deck,
        cardId,
        title: meta.title,
        description: meta.description,
        subtitle: meta.subtitle,
        effectLines: meta.effectLines
    };
};

const toUsedKey = (deck: keyof Pick<BoardDeckState, 'happiness' | 'opportunity' | 'news'>) => {
    if (deck === 'happiness') return 'usedHappiness';
    if (deck === 'opportunity') return 'usedOpportunity';
    return 'usedNews';
};

export const drawBoardCard = (
    deckState: BoardDeckState,
    deck: keyof Pick<BoardDeckState, 'happiness' | 'opportunity' | 'news'>,
    playerState?: GameState | null,
    random: () => number = Math.random
) => {
    let activeDeck = [...deckState[deck]];
    let usedDeck = [...deckState[toUsedKey(deck)]];

    if (activeDeck.length === 0) {
        activeDeck = [...usedDeck];
        for(let i=activeDeck.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[activeDeck[i],activeDeck[j]]=[activeDeck[j],activeDeck[i]];}
        usedDeck = [];
    }

    const cardId = activeDeck.shift();
    if (!cardId) return null;

    const card = buildBoardCardResultById(cardId, playerState);
    if (!card) return null;

    usedDeck.push(cardId);

    return {
        card,
        deckState: {
            ...deckState,
            [deck]: activeDeck,
            [toUsedKey(deck)]: usedDeck
        } as BoardDeckState
    };
};

export const hasCarAsset = (state?: GameState | null) => {
    return !!state?.assets?.some(asset => asset.type === '汽車' || asset.type === '飛行器');
};

export const resolveBoardDiceCount = (hasCar: boolean, requestedDiceCount?: 1 | 2): 1 | 2 => (
    hasCar && requestedDiceCount !== 1 ? 2 : 1
);

export const buildBoardMovementLegResolution = (roomData: Room, playerUid: string) => {
    const boardState = roomData.boardState;
    const movement = boardState?.movement;
    if (!boardState || !movement || movement.playerUid !== playerUid) return null;

    const playerState = roomData.playerStates?.[playerUid];
    const movementEffects = movement.effects || buildMovementEffects(
        movement.path,
        hasCarAsset(playerState)
    );
    const nextPosition = movement.path[movement.path.length - 1] ?? movement.startPosition;
    const playerName = roomData.members.find(member => member.uid === playerUid)?.name || '玩家';
    const eventTimestamp = movement.startedAt;
    const nextPlayerStates = { ...(roomData.playerStates || {}) };

    // 這段路徑是否在「經過事件」格停下（而不是走到真正的終點）。
    const isIntermediateStop = !!(movement.remainingPath && movement.remainingPath.length > 0);

    if (isIntermediateStop) {
        const square = getSquareByIndex(nextPosition);
        let event: BoardEventLog;
        let extraFields: Partial<GameState> = {};

        if (square.type === 'bank') {
            event = {
                id: `${playerUid}_${eventTimestamp}_bank`,
                playerUid,
                playerName,
                type: 'bank',
                summary: `${playerName} 經過${square.label}`,
                detail: '先領取月結餘，再決定是否購買保險或定存',
                squareIndex: nextPosition,
                timestamp: eventTimestamp,
                rollTotal: movement.rollTotal
            };
            extraFields = { bankServiceWindowActive: true, bankServiceGrantedAtEventId: event.id };
        } else if (square.type === 'school') {
            event = {
                id: `${playerUid}_${eventTimestamp}_school`,
                playerUid,
                playerName,
                type: 'school',
                summary: `${playerName} 經過${square.label}`,
                detail: '請完成升等考試',
                squareIndex: nextPosition,
                timestamp: eventTimestamp,
                rollTotal: movement.rollTotal
            };
        } else {
            event = {
                id: `${playerUid}_${eventTimestamp}_repair`,
                playerUid,
                playerName,
                type: 'repair',
                summary: `${playerName} 經過維修廠`,
                detail: '經過維修廠，請擲骰決定汽車保養費',
                squareIndex: nextPosition,
                timestamp: eventTimestamp,
                rollTotal: movement.rollTotal,
                repairHasCar: true
            };
        }
        const updatedPlayerState = playerState ? cleanObject({
            ...playerState,
            boardPosition: nextPosition,
            lastBoardEvent: event.summary,
            pendingCardAction: event.detail,
            ...extraFields
        }) : undefined;
        if (updatedPlayerState) {
            nextPlayerStates[playerUid] = updatedPlayerState;
        }

        return cleanObject({
            boardState: {
                ...boardState,
                playerPositions: {
                    ...boardState.playerPositions,
                    [playerUid]: nextPosition
                },
                ...activateBoardQueueEntry({ event }),
                pendingEvents: [],
                // 先暫停在這格（isActive:false），記住剩下要走的步數；
                // 事件結案後由 advanceBoardEventQueue 觸發下一段動畫。
                movement: {
                    ...movement,
                    path: movement.remainingPath || [],
                    remainingPath: undefined,
                    isActive: false
                },
                updatedAt: eventTimestamp
            },
            ...(Object.keys(nextPlayerStates).length > 0 ? { playerStates: nextPlayerStates } : {})
        });
    }

    // 這是最後一段：真正走到終點，比照原本落點事件邏輯處理
    // （抽卡／醫院／維修廠停留／學校停留／銀行停留）。
    const nextSkipTurns = { ...boardState.skipTurns };
    let passedBankThisTurn = false;
    const detailMessages: string[] = [];
    const landedSquare = getSquareByIndex(nextPosition);
    let deckState = boardState.deckState;
    const queuedEvents: BoardQueuedEvent[] = [];

    if (landedSquare.type === 'happiness' || landedSquare.type === 'opportunity' || landedSquare.type === 'news') {
        const drawResult = drawBoardCard(deckState, landedSquare.type, playerState);
        if (drawResult) {
            deckState = drawResult.deckState;
            detailMessages.push(`抽到${landedSquare.label}卡：${drawResult.card.title}`);
            queuedEvents.push({
                event: {
                    id: `${playerUid}_${eventTimestamp}_${landedSquare.type}`,
                    playerUid,
                    playerName,
                    type: 'card',
                    summary: `${playerName} 停在${landedSquare.label}`,
                    detail: `抽到${landedSquare.label}卡：${drawResult.card.title}`,
                    squareIndex: nextPosition,
                    timestamp: eventTimestamp,
                    rollTotal: movement.rollTotal
                },
                card: drawResult.card
            });
        }
    } else if (landedSquare.type === 'hospital') {
        const hospitalFeeCoveredByInsurance = (playerState?.medicalInsuranceCount || 0) > 0;
        detailMessages.push(hospitalFeeCoveredByInsurance
            ? '抵達醫院，醫療保險已抵免醫藥費，並暫停一回合'
            : '抵達醫院，請再擲一次骰子決定醫藥費，並暫停一回合');
        queuedEvents.push({
            event: {
                id: `${playerUid}_${eventTimestamp}_hospital`,
                playerUid,
                playerName,
                type: 'hospital',
                summary: `${playerName} 抵達醫院`,
                detail: hospitalFeeCoveredByInsurance
                    ? '醫療保險已抵免本次醫藥費，仍暫停一回合'
                    : '棋子到達後再擲一次骰子，醫藥費 = 點數 x 1000',
                squareIndex: nextPosition,
                timestamp: eventTimestamp,
                rollTotal: movement.rollTotal,
                hospitalSkipTurns: landedSquare.pauseTurns || 1,
                hospitalFeeCoveredByInsurance
            }
        });
    } else if (landedSquare.type === 'repair') {
        const hasCar = hasCarAsset(playerState);
        if (hasCarAsset(playerState)) {
            detailMessages.push('踩到維修廠，請擲骰決定保養費，並暫停一回合');
        } else {
            detailMessages.push('踩到維修廠，但目前沒有汽車');
        }
        queuedEvents.push({
            event: {
                id: `${playerUid}_${eventTimestamp}_repair`,
                playerUid,
                playerName,
                type: 'repair',
                summary: `${playerName} 停留在維修廠`,
                detail: hasCar
                    ? `棋子到達後保養費 = 點數 x 2000，並停回合 1 次`
                    : '目前沒有汽車，本次維修廠無效果',
                squareIndex: nextPosition,
                timestamp: eventTimestamp,
                rollTotal: movement.rollTotal,
                repairHasCar: hasCar,
                repairSkipTurns: hasCar ? (landedSquare.pauseTurns || 1) : undefined
            }
        });
    } else if (landedSquare.type === 'school') {
        detailMessages.push('可選擇報名升等考試');
        queuedEvents.push({
            event: {
                id: `${playerUid}_${eventTimestamp}_school_land`,
                playerUid,
                playerName,
                type: 'school',
                summary: `${playerName} 停留在學校`,
                detail: '請完成升等考試',
                squareIndex: nextPosition,
                timestamp: eventTimestamp,
                rollTotal: movement.rollTotal
            }
        });
    } else if (landedSquare.type === 'bank') {
        passedBankThisTurn = true;
        detailMessages.push('請確認本回合月結餘');
        queuedEvents.push({
            event: {
                id: `${playerUid}_${eventTimestamp}_bank_land`,
                playerUid,
                playerName,
                type: 'bank',
                summary: `${playerName} 停留在銀行`,
                detail: '先領取月結餘，再決定是否購買保險或定存',
                squareIndex: nextPosition,
                timestamp: eventTimestamp,
                rollTotal: movement.rollTotal
            }
        });
    }

    const event: BoardEventLog = {
        id: `${playerUid}_${eventTimestamp}`,
        playerUid,
        playerName,
        summary: `${playerName} 擲出 ${movement.rollTotal} 點，停在 ${landedSquare.label}`,
        detail: detailMessages.join('｜'),
        squareIndex: nextPosition,
        timestamp: eventTimestamp,
        rollTotal: movement.rollTotal
    };
    const [currentQueueEntry, ...remainingQueue] = queuedEvents;

    const updatedPlayerState = playerState ? cleanObject({
        ...playerState,
        boardPosition: nextPosition,
        skipTurns: nextSkipTurns[playerUid] || 0,
        lastBoardEvent: event.summary,
        pendingCardAction: detailMessages.join('\n'),
        bankServiceWindowActive: passedBankThisTurn ? true : playerState.bankServiceWindowActive,
        bankServiceGrantedAtEventId: passedBankThisTurn ? currentQueueEntry?.event.id : playerState.bankServiceGrantedAtEventId
    }) : undefined;

    if (updatedPlayerState) {
        nextPlayerStates[playerUid] = updatedPlayerState;
    }

    // 回合不再於移動/事件結算後自動換人：玩家自己按「結束回合」才會真正切換到
    // 下一位，這裡無論有沒有排隊事件，currentTurnUid 都維持在移動的玩家身上。
    return cleanObject({
        boardState: {
            ...boardState,
            playerPositions: {
                ...boardState.playerPositions,
                [playerUid]: nextPosition
            },
            skipTurns: nextSkipTurns,
            currentTurnUid: playerUid,
            lastRoll: boardState.lastRoll,
            ...activateBoardQueueEntry(currentQueueEntry),
            pendingEvents: remainingQueue,
            movement: null,
            deckState,
            cardLog: appendBoardCardLog(boardState, currentQueueEntry?.card || null, currentQueueEntry?.event || null),
            updatedAt: eventTimestamp
        },
        ...(Object.keys(nextPlayerStates).length > 0 ? { playerStates: nextPlayerStates } : {})
    });
};

export const getNextBoardSquare = (position:number,type:BoardSquareType) => {
 if(!Number.isSafeInteger(position)||position<0||position>=BOARD_SQUARES.length)throw new Error('棋盤位置無效');
 const next=BOARD_SQUARES.filter(square=>square.type===type&&square.index!==position).reduce<typeof BOARD_SQUARES[number]|null>((closest,square)=>!closest||(square.index-position+BOARD_SQUARES.length)%BOARD_SQUARES.length<(closest.index-position+BOARD_SQUARES.length)%BOARD_SQUARES.length?square:closest,null);
 if(!next)throw new Error('找不到目標棋盤格');return next;
};
