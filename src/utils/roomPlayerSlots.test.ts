import { describe, expect, it } from 'vitest';
import { buildRoomPlayerSlotUpdate, getRoomPlayerSlots } from './roomPlayerSlots';

describe('room player slots', () => {
  it('keeps legacy room capacity and renders remaining slots closed', () => {
    expect(getRoomPlayerSlots(2).map(slot => slot.isOpen)).toEqual([true, true, false, false, false, false]);
  });

  it('opens a previously closed slot and updates room capacity', () => {
    expect(buildRoomPlayerSlotUpdate(2, undefined, 4, true, 1)).toEqual({
      maxPlayers: 3,
      closedPlayerSlots: [2, 3, 5]
    });
  });

  it('does not allow closing an occupied slot or the last open slot', () => {
    expect(() => buildRoomPlayerSlotUpdate(2, undefined, 0, false, 1)).toThrow('此欄位已有玩家');
    expect(() => buildRoomPlayerSlotUpdate(1, undefined, 0, false, 0)).toThrow('至少保留一個');
  });
});
