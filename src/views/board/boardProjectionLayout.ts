export const TILE_WIDTH = 132;
export const TILE_HEIGHT = 92;
export const TILE_GAP = 14;
export const BOARD_COLUMNS = 16;
export const BOARD_ROWS = 12;
export const BOARD_PADDING = 72;
export const BOARD_GRID_WIDTH = TILE_WIDTH * BOARD_COLUMNS + TILE_GAP * (BOARD_COLUMNS - 1);
export const BOARD_GRID_HEIGHT = TILE_HEIGHT * BOARD_ROWS + TILE_GAP * (BOARD_ROWS - 1);
export const BOARD_WIDTH = BOARD_GRID_WIDTH + BOARD_PADDING * 2;
export const BOARD_HEIGHT = BOARD_GRID_HEIGHT + BOARD_PADDING * 2;

const PLAYER_TOKEN_COLORS = [
  { base: '#168F84', dark: '#0B5F59', glow: 'rgba(22,143,132,0.48)' },
  { base: '#D9654A', dark: '#9E3F2D', glow: 'rgba(217,101,74,0.48)' },
  { base: '#D9A62E', dark: '#916A12', glow: 'rgba(217,166,46,0.48)' },
  { base: '#3F78A8', dark: '#285176', glow: 'rgba(63,120,168,0.48)' },
  { base: '#8B6BA8', dark: '#5E4775', glow: 'rgba(139,107,168,0.48)' },
  { base: '#6D983D', dark: '#476727', glow: 'rgba(109,152,61,0.48)' },
  { base: '#C66C2E', dark: '#884518', glow: 'rgba(198,108,46,0.48)' },
  { base: '#C94F78', dark: '#8D3152', glow: 'rgba(201,79,120,0.48)' },
] as const;

export const getProjectionGridCoordinates = (index: number) => {
  const normalizedIndex = ((index % 52) + 52) % 52;
  if (normalizedIndex <= 15) return { column: normalizedIndex + 1, row: 1 };
  if (normalizedIndex <= 25) return { column: BOARD_COLUMNS, row: normalizedIndex - 14 };
  if (normalizedIndex <= 41) return { column: 42 - normalizedIndex, row: BOARD_ROWS };
  return { column: 1, row: 53 - normalizedIndex };
};

export const getProjectionTileCenter = (index: number) => {
  const { column, row } = getProjectionGridCoordinates(index);
  return {
    x: BOARD_PADDING + (column - 1) * (TILE_WIDTH + TILE_GAP) + TILE_WIDTH / 2,
    y: BOARD_PADDING + (row - 1) * (TILE_HEIGHT + TILE_GAP) + TILE_HEIGHT / 2,
  };
};

export const getProjectionPlayerColor = (turnOrderIndex: number) => (
  PLAYER_TOKEN_COLORS[((turnOrderIndex % PLAYER_TOKEN_COLORS.length) + PLAYER_TOKEN_COLORS.length) % PLAYER_TOKEN_COLORS.length]
);

export const getProjectionPlayerOffset = (playerIndex: number, playerCount: number) => {
  if (playerCount <= 1) return { x: 0, y: 0 };
  if (playerCount === 2) return { x: playerIndex === 0 ? -22 : 22, y: 0 };
  if (playerCount === 3) {
    return [
      { x: 0, y: -18 },
      { x: -22, y: 16 },
      { x: 22, y: 16 },
    ][playerIndex] || { x: 0, y: 0 };
  }

  const radius = Math.min(30, 21 + playerCount);
  const angle = -Math.PI / 2 + (Math.PI * 2 * playerIndex) / playerCount;
  return {
    x: Math.round(Math.cos(angle) * radius),
    y: Math.round(Math.sin(angle) * radius),
  };
};
