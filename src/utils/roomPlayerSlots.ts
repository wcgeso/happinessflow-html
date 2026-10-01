export const ROOM_PLAYER_SLOT_COUNT = 6;

export interface RoomPlayerSlot {
  index: number;
  isOpen: boolean;
}

export const getRoomPlayerSlots = (maxPlayers: number, closedPlayerSlots?: number[]): RoomPlayerSlot[] => {
  const legacyClosedSlots = Array.from(
    { length: ROOM_PLAYER_SLOT_COUNT },
    (_, index) => index
  ).filter(index => index >= maxPlayers);
  const closed = new Set(closedPlayerSlots ?? legacyClosedSlots);

  return Array.from({ length: ROOM_PLAYER_SLOT_COUNT }, (_, index) => ({
    index,
    isOpen: !closed.has(index)
  }));
};

export const buildRoomPlayerSlotUpdate = (
  maxPlayers: number,
  closedPlayerSlots: number[] | undefined,
  slotIndex: number,
  isOpen: boolean,
  occupiedPlayerCount: number
) => {
  const slots = getRoomPlayerSlots(maxPlayers, closedPlayerSlots);
  const slot = slots[slotIndex];
  if (!slot) throw new Error('玩家欄位不存在');
  if (slot.isOpen === isOpen) return null;

  const openIndices = slots.filter(item => item.isOpen).map(item => item.index);
  if (!isOpen && openIndices.slice(0, occupiedPlayerCount).includes(slotIndex)) {
    throw new Error('此欄位已有玩家，請先讓玩家離開');
  }

  const nextOpenIndices = isOpen
    ? [...openIndices, slotIndex].sort((a, b) => a - b)
    : openIndices.filter(index => index !== slotIndex);
  if (nextOpenIndices.length < occupiedPlayerCount) {
    throw new Error('開放欄位不可少於目前玩家人數');
  }
  if (nextOpenIndices.length === 0) throw new Error('至少保留一個開放的玩家欄位');

  return {
    maxPlayers: nextOpenIndices.length,
    closedPlayerSlots: slots
      .map(item => item.index)
      .filter(index => !nextOpenIndices.includes(index))
  };
};
