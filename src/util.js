const {pipe, filter} = require('rxjs');

/**
 * @template T
 * @template {keyof T} K
 * @param {T} obj
 * @param {...K} keys
 * @returns {Pick<T,K>}
 */
exports.pick = function pick(obj, ...keys) {
  const ret = /** @type {any} */ ({});
  keys.forEach((key) => {
    ret[key] = obj[key];
  });
  return ret;
};

/**
 * @template T
 * @returns {import('rxjs').UnaryFunction<import('rxjs').Observable<T|null|undefined>, import('rxjs').Observable<T>> }
 */
exports.filterNullish = function filterNullish() {
  return pipe(
    /** @type {import('rxjs').OperatorFunction<T|null|undefined, T>} */ (
      filter((x) => x != null)
    )
  );
};
