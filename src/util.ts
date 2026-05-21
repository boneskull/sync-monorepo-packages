/**
 * Picks the specified keys from an object, returning a new object with only
 * those keys.
 *
 * @param obj - Source object
 * @param keys - Keys to pick
 * @returns New object containing only the specified keys
 */
export const pick = <T, K extends keyof T>(
  obj: T,
  ...keys: K[]
): Pick<T, K> => {
  const ret = {} as Pick<T, K>;
  for (const key of keys) {
    ret[key] = obj[key];
  }
  return ret;
};
