/**
 * Picks the specified keys from an object, returning a new object with only
 * those keys.
 *
 * @param obj - Source object
 * @param keys - Keys to pick
 * @returns New object containing only the specified keys
 */
export const pick = (obj, ...keys) => {
  const ret = {};
  for (const key of keys) {
    ret[key] = obj[key];
  }
  return ret;
};
//# sourceMappingURL=util.js.map
