import type {Operation} from 'rfc6902';
import type {PackageJson} from 'type-fest';

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
  constructor(
    /**
     * Source file path (relative to process.cwd())
     */
    public readonly from: string,
    /**
     * Destination file path (relative to process.cwd())
     */
    public readonly to: string,
    /**
     * Error encountered during copy, if any
     */
    public readonly err?: Error,
    /**
     * Whether the copy succeeded
     */
    public readonly success?: boolean,
  ) {}

  toString(): string {
    return this.err
      ? `Could not synchronize file from ${this.from} to ${this.to}: ${this.err.message}`
      : `Synchronized file ${this.from} to ${this.to}`;
  }

  /**
   * Returns a new instance with the given error attached.
   *
   * @param err - The error that occurred
   */
  withError(err: Error): FileCopyResult {
    return new FileCopyResult(this.from, this.to, err);
  }

  /**
   * Returns a new instance marked as successfully copied.
   */
  withSuccess(): FileCopyResult {
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
  constructor(
    /**
     * Absolute path to the destination package.json
     */
    public readonly pkgPath: string,
    /**
     * JSON patch to apply
     */
    public readonly patch: Operation[],
    /**
     * Original package.json contents
     */
    public readonly pkg: PackageJson,
    /**
     * Updated package.json contents (set after applying the patch)
     */
    public readonly newPkg?: PackageJson,
  ) {}

  toString(): string {
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
  withNewPackage(newPkg: PackageJson): PkgChangeResult {
    return new PkgChangeResult(
      this.pkgPath,
      [...this.patch],
      {...this.pkg},
      newPkg,
    );
  }
}
