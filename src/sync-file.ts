import createDebug from 'debug';
import {constants} from 'node:fs';
import {copyFile, mkdir, stat} from 'node:fs/promises';
import {dirname, join, relative, resolve} from 'node:path';

import {SyncMonorepoPackagesError} from './error.js';
import {
  findDirectoriesByGlobs,
  findLernaConfig,
  findWorkspaces,
} from './find-package.js';
import {FileCopyResult} from './model.js';

const debug = createDebug('sync-monorepo-packages:sync-file');

/**
 * A brief summary of the results of a sync operation.
 */
export interface Summary {
  /** Message describing a failure */
  fail?: string;
  /** Message when nothing needed to be done */
  noop?: string;
  /** Message describing success */
  success?: string;
}

/**
 * Options for {@link syncFile}.
 */
export interface SyncFileOptions {
  /**
   * Working directory (used for package discovery). Defaults to
   * `process.cwd()`.
   */
  cwd?: string;
  /** If `true`, simulate the operation without writing any files. */
  dryRun?: boolean;
  /** If `true`, overwrite existing destination files. */
  force?: boolean;
  /** Path to `lerna.json`, if any. */
  lerna?: string;
  /** Explicit list of destination package directories. */
  packages?: string[];
}

const pluralize = (word: string, count: number): string =>
  count === 1 ? word : `${word}s`;

/**
 * Synchronizes one or more source files to all packages in a monorepo. Yields a
 * {@link FileCopyResult} for each (source, destination) pair attempted.
 *
 * @example
 *
 * ```ts
 * for await (const result of syncFile(['README.md'], {dryRun: true})) {
 *   console.log(result.toString());
 * }
 * ```
 *
 * @param files - Source file paths or globs (relative to `process.cwd()`)
 * @param opts - Sync options
 */
export const syncFile = async function* (
  files: string[] = [],
  {
    cwd = process.cwd(),
    dryRun = false,
    force = false,
    lerna: lernaJsonPath,
    packages = [],
  }: SyncFileOptions = {},
): AsyncGenerator<FileCopyResult> {
  debug(
    'syncFile called with force: %s, packages: %O, files: %O',
    force,
    packages,
    files,
  );

  if (!files.length) {
    throw new SyncMonorepoPackagesError('No files to sync!');
  }

  const {glob} = await import('node:fs/promises');

  // Expand file globs relative to process.cwd()
  const resolvedFiles: string[] = [];
  for (const filePattern of files) {
    const matched: string[] = [];
    for await (const entry of glob(filePattern, {cwd: process.cwd()})) {
      matched.push(entry);
    }
    if (!matched.length) {
      throw new SyncMonorepoPackagesError(
        `Could not find any files matching glob "${filePattern}"`,
      );
    }
    resolvedFiles.push(...matched);
  }

  // Find package directories
  let packageDirs: string[];
  let packagesCwd: string;

  if (packages.length) {
    packageDirs = packages;
    packagesCwd = cwd;
  } else {
    const lernaInfo = await findLernaConfig({cwd, lernaJsonPath});
    const lernaPackageDirs: string[] = [];
    if (lernaInfo?.lernaConfig.packages?.length) {
      for await (const dir of findDirectoriesByGlobs(
        lernaInfo.lernaConfig.packages,
        lernaInfo.lernaRoot,
      )) {
        lernaPackageDirs.push(dir);
      }
    }

    const workspaces = await findWorkspaces(cwd);
    const workspaceDirs: string[] = [];
    for await (const dir of findDirectoriesByGlobs(workspaces, cwd)) {
      workspaceDirs.push(dir);
    }

    packageDirs = [...new Set([...lernaPackageDirs, ...workspaceDirs])];
    packagesCwd = cwd;
  }

  for (const srcFilePath of resolvedFiles) {
    for (const packageDir of packageDirs) {
      const absPackageDir = resolve(packagesCwd, packageDir);
      const absCwd = resolve(process.cwd(), packagesCwd);
      const srcRelativeToCwd = relative(absCwd, srcFilePath);
      const absDest = join(absPackageDir, srcRelativeToCwd);
      const destPath = relative(process.cwd(), absDest);

      const copyInfo = new FileCopyResult(srcFilePath, destPath);

      debug(
        'attempting to copy %s to %s (overwrite: %s)',
        copyInfo.from,
        copyInfo.to,
        force,
      );

      if (dryRun) {
        if (!force) {
          try {
            await stat(destPath);
            // Destination exists; simulate the EEXIST failure.
            yield copyInfo.withError(
              new SyncMonorepoPackagesError(
                `Refusing to overwrite existing file ${destPath}; use --force to overwrite`,
              ),
            );
          } catch (err) {
            if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
              yield copyInfo.withSuccess();
            } else {
              throw err;
            }
          }
        } else {
          yield copyInfo.withSuccess();
        }
      } else {
        try {
          await mkdir(dirname(destPath), {recursive: true});
          await copyFile(
            srcFilePath,
            destPath,
            force ? 0 : constants.COPYFILE_EXCL,
          );
          yield copyInfo.withSuccess();
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
            yield copyInfo.withError(
              new SyncMonorepoPackagesError(
                `Refusing to overwrite existing file ${destPath}; use --force to overwrite`,
              ),
            );
          } else {
            throw err;
          }
        }
      }
    }
  }
};

/**
 * Summarizes the results of one or more {@link syncFile} operations.
 *
 * @param results - Array of {@link FileCopyResult} values
 * @returns A {@link Summary} object describing what happened
 */
export const summarizeFileCopies = (results: FileCopyResult[]): Summary => {
  const successes = results.filter((r) => r.success);
  const failures = results.filter((r) => r.err);

  if (!successes.length && !failures.length) {
    return {noop: 'No files copied.'};
  }

  const summary: Summary = {};
  if (successes.length) {
    const sources = new Set(successes.map((r) => r.from));
    summary.success = `Copied ${sources.size} ${pluralize('file', sources.size)} to ${successes.length} ${pluralize('package', successes.length)}`;
  }
  if (failures.length) {
    const sources = new Set(failures.map((r) => r.from));
    summary.fail = `Failed to copy ${sources.size} ${pluralize('file', sources.size)} to ${failures.length} ${pluralize('package', failures.length)}; use --verbose for details`;
  }
  return summary;
};
