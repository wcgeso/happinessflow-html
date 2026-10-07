import {renderHook} from '@testing-library/react';
import {expect, it} from 'vitest';
import {useStableActions} from './useStableActions';

it('keeps action identity across renders while calling the latest closure', () => {
  const hook = renderHook(({value}) => useStableActions({read: () => value, add: (n: number) => value + n}), {initialProps: {value: 1}});
  const first = hook.result.current;
  expect(first.read()).toBe(1);
  hook.rerender({value: 5});
  expect(hook.result.current).toBe(first);
  expect(hook.result.current.read).toBe(first.read);
  expect(first.read()).toBe(5);
  expect(first.add(2)).toBe(7);
});
