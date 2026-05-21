import {inspect} from 'node:util';
/**
 * Represents the result of a file-copy operation between a source and a
 * destination package.
 *
 * @example
 *
 * ```ts
 * const result = new FileCopyResult('README.md', 'packages/foo/README.md');
 * ```
 */
export class FileCopyResult {
  from;
  to;
  err;
  success;
  constructor(
    /**
     * Source file path (relative to process.cwd())
     */
    from,
    /**
     * Destination file path (relative to process.cwd())
     */
    to,
    /**
     * Error encountered during copy, if any
     */
    err,
    /**
     * Whether the copy succeeded
     */
    success,
  ) {
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
   * Returns a new instance with the given error attached.
   *
   * @param err - The error that occurred
   */
  withError(err) {
    return new FileCopyResult(this.from, this.to, err);
  }
  /**
   * Returns a new instance marked as successfully copied.
   */
  withSuccess() {
    return new FileCopyResult(this.from, this.to, undefined, true);
  }
}
/**
 * Represents the result of a `package.json` field-synchronization operation.
 *
 * @example
 *
 * ```ts
 * const result = new PkgChangeResult(
 *   'packages/foo/package.json',
 *   patch,
 *   pkg,
 * );
 * ```
 */
export class PkgChangeResult {
  pkgPath;
  patch;
  pkg;
  newPkg;
  constructor(
    /**
     * Absolute path to the destination package.json
     */
    pkgPath,
    /**
     * JSON patch to apply
     */
    patch,
    /**
     * Original package.json contents
     */
    pkg,
    /**
     * Updated package.json contents (set after applying the patch)
     */
    newPkg,
  ) {
    this.pkgPath = pkgPath;
    this.patch = patch;
    this.pkg = pkg;
    this.newPkg = newPkg;
  }
  toString() {
    return `${this.pkgPath} - Applied patch: ${inspect(this.patch, {
      breakLength: Infinity,
      colors: true,
      compact: true,
    })}`;
  }
  /**
   * Returns a new instance with the updated package contents set.
   *
   * @param newPkg - The updated package.json
   */
  withNewPackage(newPkg) {
    return new PkgChangeResult(
      this.pkgPath,
      [...this.patch],
      {...this.pkg},
      newPkg,
    );
  }
}
//# sourceMappingURL=model.js.map
