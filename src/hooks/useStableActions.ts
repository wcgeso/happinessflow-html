import {useMemo, useRef} from 'react';

type AnyFn = (...args: never[]) => unknown;

/**
 * Returns wrappers with a permanent identity that always call the latest implementation.
 * Lets a large provider recreate its action closures every render while consumers that only
 * hold actions (memoized children, effect deps) never see them change.
 * The set of keys must not change between renders.
 */
export function useStableActions<T extends Record<string, AnyFn>>(latest: T): T {
  const ref = useRef(latest);
  ref.current = latest;
  return useMemo(() => {
    const stable = {} as Record<string, AnyFn>;
    for (const key of Object.keys(latest)) {
      stable[key] = ((...args: never[]) => (ref.current[key] as AnyFn)(...args)) as AnyFn;
    }
    return stable as T;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
