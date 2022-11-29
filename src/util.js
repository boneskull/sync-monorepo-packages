const {pipe} = require('rxjs');
const {filter} = require('rxjs/operators');

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
 * @returns {import('rxjs').UnaryFunction<Observable<T>, Observable<NonNullable<T>>> }
 */
exports.filterNullish = function filterNullish() {
  return pipe(
    /** @type {import('rxjs').OperatorFunction<T, NonNullable<T>>} */ (
      filter((x) => x != null)
    )
  );
};

/**
 * @template T
 * @typedef {import('rxjs').Observable<T>} Observable
 */
