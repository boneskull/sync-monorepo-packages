const {inspect} = require('util');

/**
 * Represents the result of a file-copy operation. Do not use directly; use {@linkcode createFileCopyResult} instead.
 */
class FileCopyResult {
  /**
   * @param {string} from - Source filepath
   * @param {string} to - Destination filepath
   * @param {FileCopyResultOpts} [opts] - Options
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
   * Return a clone of this object, but add an Error
   * @param {Error} err - Error
   */
  withError(err) {
    return Object.freeze(new FileCopyResult(this.from, this.to, {err}));
  }

  /**
   * Return a clone of thios object, but mark as successfully copied
   */
  withSuccess() {
    return Object.freeze(
      new FileCopyResult(this.from, this.to, {success: true})
    );
  }
}

/**
 * Represents the result of a `package.json` modification
 */
class PkgChangeResult {
  /**
   *
   * @param {string} pkgPath - Path to destination package.json
   * @param {Operation[]} patch - JSON patch
   * @param {PackageJson} pkg - Original package.json
   * @param {PackageJson} [newPkg] - Updated package.json
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
      breakLength: Infinity,
    })}`;
  }

  /**
   *
   * @param {PackageJson} newPkg
   * @returns {Readonly<PkgChangeResult>}
   */
  withNewPackage(newPkg) {
    return Object.freeze(
      new PkgChangeResult(this.pkgPath, [...this.patch], {...this.pkg}, newPkg)
    );
  }
}

/**
 * Creates a {@linkcode FileCopyResult} object.
 * @param {string} from
 * @param {string} to
 * @param {FileCopyResultOpts} [opts]
 * @returns {Readonly<FileCopyResult>}
 */
exports.createFileCopyResult = (from, to, {err, success} = {}) =>
  Object.freeze(new FileCopyResult(from, to, {err, success}));

/**
 * Creates a {@linkcode PkgChangeResult} object.
 * @param {string} pkgPath
 * @param {Operation[]} patch
 * @param {PackageJson} pkg
 * @param {PackageJson} [newPkg]
 */
exports.createPkgChangeResult = (pkgPath, patch, pkg, newPkg) =>
  Object.freeze(new PkgChangeResult(pkgPath, patch, pkg, newPkg));

/**
 * @typedef {import('type-fest').PackageJson} PackageJson
 * @typedef {import('rfc6902').Operation} Operation
 */

/**
 * @typedef FileCopyResultOpts
 * @property {Error} [err]
 * @property {boolean} [success]
 */

exports.FileCopyResult = FileCopyResult;
exports.PkgChangeResult = PkgChangeResult;
