import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DiceFace } from './DiceFace';

describe('DiceFace', () => {
  it('places all six pips at explicit grid coordinates', () => {
    const markup = renderToStaticMarkup(<DiceFace value={6} rolling={false} />);

    expect(markup.match(/grid-column-start:/g)).toHaveLength(6);
    expect(markup).toContain('grid-column-start:3;grid-row-start:3');
  });
});
