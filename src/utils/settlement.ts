import type { GameState, PublicPlayerState } from '../types';

export interface SettlementPlayer {
  uid: string;
  name: string;
  happiness: number;
  rank: number;
  isWinner: boolean;
  profession?: string;
  state?: GameState;
}

interface SettlementRoomLike {
  hostId: string;
  members?: Array<{ uid: string; name?: string; isLeft?: boolean }>;
  publicPlayerStates?: Record<string, PublicPlayerState>;
  playerStates?: Record<string, GameState>;
}

export const rankSettlementPlayers = (players: Array<Omit<SettlementPlayer, 'rank' | 'isWinner'>>): SettlementPlayer[] => {
  const sorted = [...players].sort((a, b) => b.happiness - a.happiness || a.name.localeCompare(b.name));
  let previousHappiness: number | null = null;
  let previousRank = 0;

  return sorted.map((player, index) => {
    const rank = previousHappiness === player.happiness ? previousRank : index + 1;
    previousHappiness = player.happiness;
    previousRank = rank;
    return { ...player, rank, isWinner: rank === 1 };
  });
};

export const buildSettlementPlayers = (
  room: SettlementRoomLike | null | undefined,
  privateStates: Record<string, GameState> = {}
): SettlementPlayer[] => {
  if (!room) return [];

  const publicStates = room.publicPlayerStates || {};
  const uids = new Set([
    ...Object.keys(publicStates),
    ...Object.keys(room.playerStates || {}),
    ...(room.members || []).filter(member => member.uid !== room.hostId && !member.isLeft).map(member => member.uid),
  ]);

  return rankSettlementPlayers(Array.from(uids)
    .filter(uid => uid !== room.hostId)
    .map(uid => {
      const state = privateStates[uid] || room.playerStates?.[uid];
      const publicState = publicStates[uid];
      const member = room.members?.find(item => item.uid === uid);
      return {
        uid,
        name: state?.playerName || publicState?.playerName || member?.name || '玩家',
        happiness: state?.happinessTotal ?? publicState?.happinessTotal ?? 0,
        profession: state?.profession?.title || state?.currentRankTitle,
        state,
      };
    }));
};

export const buildLifeRecap = (state?: GameState | null) => {
  if (!state) return null;
  const history = [...(state.history || [])].sort((a, b) => a.timestamp - b.timestamp);
  const firstPositive = history.find(transaction => transaction.cashChange > 0);
  const firstAsset = history.find(transaction => transaction.name.includes('買入') || transaction.name.includes('購買'));
  const milestones = (state.happiness || [])
    .filter(item => item.checked)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3)
    .map(item => item.label);

  return {
    firstPositive: firstPositive?.name || null,
    firstAsset: firstAsset?.name || null,
    milestones,
    cash: state.cash,
    happiness: state.happinessTotal,
    profession: state.profession?.title || state.currentRankTitle || '尚未設定',
  };
};
