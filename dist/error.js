/**
 * Custom error class for sync-monorepo-packages operations.
 *
 * @example
 *
 * ```ts
 * throw new SyncMonorepoPackagesError('Something went wrong');
 * ```
 */
export class SyncMonorepoPackagesError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SyncMonorepoPackagesError';
  }
}
//# sourceMappingURL=error.js.map
