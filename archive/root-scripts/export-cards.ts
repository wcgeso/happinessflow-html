import { HAPPINESS_CARDS, OPPORTUNITY_CARDS, NEWS_CARDS } from './src/constants/cards.ts';
import * as fs from 'fs';

const allCards = [
    ...HAPPINESS_CARDS.map(c => ({ deck: 'happiness', ...c })),
    ...OPPORTUNITY_CARDS.map(c => ({ deck: 'opportunity', ...c })),
    ...NEWS_CARDS.map(c => ({ deck: 'news', ...c }))
];

fs.writeFileSync('project_cards_0611.json', JSON.stringify(allCards, null, 2));
