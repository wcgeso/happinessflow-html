// Forces the next draw from a given deck in a seeded room to return a
// specific card id, by rewriting boardState.deckState directly via the
// Admin SDK. Relies on drawBoardCard() in src/context/RoomContext.tsx simply
// doing `deckState[deck].shift()` — putting the target card at index 0 (with
// every other known id of that deck behind it, used pile cleared) guarantees
// it's drawn next regardless of what was already in the deck.

import { getEmulatorDb } from './adminClient.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CARD_FILES = {
  happiness: 'happiness.cards.json',
  opportunity: 'opportunity.cards.json',
  news: 'news.cards.json',
} as const;

export type DeckName = keyof typeof CARD_FILES;

const readCardIds = (deck: DeckName): string[] => {
  const jsonPath = path.join(__dirname, '../../src/data/cards', CARD_FILES[deck]);
  const raw = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  return raw.map((card: { id: string }) => card.id);
};

export const forceNextCard = async (roomCode: string, deck: DeckName, cardId: string) => {
  const allIds = readCardIds(deck);
  if (!allIds.includes(cardId)) {
    throw new Error(`[e2e/forceNextCard] Unknown ${deck} card id: ${cardId}`);
  }
  const rest = allIds.filter((id) => id !== cardId);
  const deckKey = deck; // 'happiness' | 'opportunity' | 'news'
  const usedKey = `used${deck[0].toUpperCase()}${deck.slice(1)}`; // usedHappiness | usedOpportunity | usedNews

  const db = getEmulatorDb();
  await db.collection('rooms').doc(roomCode).update({
    [`boardState.deckState.${deckKey}`]: [cardId, ...rest],
    [`boardState.deckState.${usedKey}`]: [],
  });
};

const isMain = process.argv[1] && process.argv[1].endsWith('forceNextCard.ts');
if (isMain) {
  const [roomCode, deck, cardId] = process.argv.slice(2);
  if (!roomCode || !deck || !cardId) {
    console.error('Usage: tsx scripts/e2e/forceNextCard.ts <roomCode> <happiness|opportunity|news> <cardId>');
    process.exit(1);
  }
  forceNextCard(roomCode, deck as DeckName, cardId)
    .then(() => {
      console.log(`[e2e/forceNextCard] Room ${roomCode}: next ${deck} draw forced to ${cardId}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[e2e/forceNextCard] Failed:', err);
      process.exit(1);
    });
}
