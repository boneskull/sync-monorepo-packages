const logSymbols = require('log-symbols');
const {inspect} = require('util');

/**
 * Represents the result of a file-copy operation
 */
class CopyInfo {
  /**
   *
   * @param {string} from - Source filepath
   * @param {string} to - Destination filepath
   * @param {{err?: Error, success?: boolean}} - State
   */
  constructor(from, to, {err, success} = {}) {
    this.from = from;
    this.to = to;
    this.err = err;
    this.success = success;
  }

  toString() {
    return this.err
      ? `${logSymbols.error} Could not synchronize file from ${this.from} to ${this.to}: ${this.err.message}`
      : `${logSymbols.info} Synchronized file ${this.from} to ${this.to}`;
  }

  /**
   * Return a clone of the CopyInfo object but add an Error
   * @param {Error} err - Errord
   */
  withError(err) {
    return Object.freeze(new CopyInfo(this.from, this.to, {err}));
  }

  withSuccess() {
    return Object.freeze(new CopyInfo(this.from, this.to, {success: true}));
  }
}

/**
 * Represents the result of a package.json modification
 */
class PackageChange {
  /**
   *
   * @param {any?} from - Original field value in destination
   * @param {any?} to - Field value in source (to sync)
   * @param {string} pkgPath - Path to destination package.json
   * @param {string} field - Name of top-level field to sync
   * @param {import('type-fest').PackageJson} pkg - Original package.json
   * @param {import('type-fest').PackageJson?} newPkg - Updated package.json
   */
  constructor(from, to, pkgPath, field, pkg, newPkg) {
    this.from = from;
    this.to = to;
    this.pkgPath = pkgPath;
    this.field = field;
    this.pkg = pkg;
    this.newPkg = newPkg;
  }

  /**
   * Returns a human-readable inspection of a field value
   * @param {any?} value - Field value to inspect
   */
  static inspectFieldValue(value) {
    return value === undefined
      ? '(undefined)'
      : inspect(value, {
          colors: true,
          compact: true,
          breakLength: Infinity
        });
  }

  toString() {
    const from = PackageChange.inspectFieldValue(this.from);
    const to = PackageChange.inspectFieldValue(this.to);
    return `${logSymbols.info} ${this.pkgPath} - Synchronized field "${this.field}": ${from} => ${to}`;
  }

  withNewPackage(newPkg) {
    return Object.freeze(
      new PackageChange(
        this.from,
        this.to,
        this.pkgPath,
        this.field,
        this.pkg,
        newPkg
      )
    );
  }
}

exports.createCopyInfo = (...args) => Object.freeze(new CopyInfo(...args));

exports.createPackageChange = (...args) =>
  Object.freeze(new PackageChange(...args));

exports.PackageChange = PackageChange;
exports.CopyInfo = CopyInfo;
