const {inspect} = require('util');

/**
 * Represents the result of a file-copy operation
 */
exports.CopyInfo = class CopyInfo {
  /**
   *
   * @param {string} from - Source filepath
   * @param {string} to - Destination filepath
   * @param {{err?: Error, success?: boolean}} opts - State
   */
  constructor(from, to, {err, success} = {}) {
    this.from = from;
    this.to = to;
    this.err = err;
    this.success = success;
  }

  toString() {
    return this.err
      ? `Could not synchronize file from ${this.from} to ${this.to}: ${this.err.message}`
      : `Synchronized file ${this.from} to ${this.to}`;
  }

  /**
   * Return a clone of the CopyInfo object but add an Error
   * @param {Error} err - Error
   */
  withError(err) {
    return Object.freeze(new CopyInfo(this.from, this.to, {err}));
  }

  /**
   * Return a clone of the CopyInfo object but mark as successfully copied
   */
  withSuccess() {
    return Object.freeze(new CopyInfo(this.from, this.to, {success: true}));
  }
};

/**
 * Represents the result of a package.json modification
 */
exports.PackageChange = class PackageChange {
  /**
   *
   * @param {string} pkgPath - Path to destination package.json
   * @param {Operation[]} patch - JSON patch
   * @param {PackageJson} pkg - Original package.json
   * @param {PackageJson?} newPkg - Updated package.json
   */
  constructor(pkgPath, patch, pkg, newPkg) {
    this.pkgPath = pkgPath;
    this.patch = patch;
    this.pkg = pkg;
    this.newPkg = newPkg;
  }

  toString() {
    return `${this.pkgPath} - Applied patch: ${inspect(this.patch, {
      colors: true,
      compact: true,
      breakLength: Infinity
    })}`;
  }

  withNewPackage(newPkg) {
    return Object.freeze(
      new PackageChange(this.pkgPath, [...this.patch], {...this.pkg}, newPkg)
    );
  }
};

/**
 * @param {string} from
 * @param {string} to
 * @param {{err?: Error, success?: boolean}} opts - State
 */
exports.createCopyInfo = (from, to, {err, success} = {}) =>
  Object.freeze(new exports.CopyInfo(from, to, {err, success}));

/**
 * @param {string} pkgPath
 * @param {Operation[]} patch
 * @param {PackageJson} pkg
 * @param {PackageJson} [newPkg]
 */
exports.createPackageChange = (pkgPath, patch, pkg, newPkg) =>
  Object.freeze(new exports.PackageChange(pkgPath, patch, pkg, newPkg));

/**
 * @typedef {import('type-fest').PackageJson} PackageJson
 * @typedef {import('rfc6902').Operation} Operation
 */
