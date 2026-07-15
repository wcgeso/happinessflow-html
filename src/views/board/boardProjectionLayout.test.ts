import { describe, expect, it } from 'vitest';
import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  getProjectionGridCoordinates,
  getProjectionPlayerColor,
  getProjectionPlayerOffset,
} from './boardProjectionLayout';

describe('board projection layout', () => {
  it('maps all 52 squares to unique cells on the 16 by 12 perimeter', () => {
    const coordinates = Array.from({ length: 52 }, (_, index) => getProjectionGridCoordinates(index));
    const uniqueCoordinates = new Set(coordinates.map(({ column, row }) => `${column}:${row}`));

    expect(uniqueCoordinates.size).toBe(52);
    coordinates.forEach(({ column, row }) => {
      expect(column === 1 || column === BOARD_COLUMNS || row === 1 || row === BOARD_ROWS).toBe(true);
    });
  });

  it('keeps player colors stable by turn-order position', () => {
    expect(getProjectionPlayerColor(0)).toEqual(getProjectionPlayerColor(8));
    expect(getProjectionPlayerColor(0)).not.toEqual(getProjectionPlayerColor(1));
  });

  it.each([1, 2, 3, 4, 6])('gives %i players unique same-square offsets', playerCount => {
    const offsets = Array.from({ length: playerCount }, (_, index) => getProjectionPlayerOffset(index, playerCount));
    expect(new Set(offsets.map(({ x, y }) => `${x}:${y}`)).size).toBe(playerCount);
  });
});
