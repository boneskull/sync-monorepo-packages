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
  constructor(message: string) {
    super(message);
    this.name = 'SyncMonorepoPackagesError';
  }
}
