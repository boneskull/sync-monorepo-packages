import type {PackageJson} from 'type-fest';

import createDebug from 'debug';
import {readFile, writeFile} from 'node:fs/promises';
import {basename, join} from 'node:path';
import {applyPatch, createPatch} from 'rfc6902';

import {SyncMonorepoPackagesError} from './error.js';
import {findPackageJsons, PACKAGE_JSON, walkUp} from './find-package.js';
import {PkgChangeResult} from './model.js';
import {pick} from './util.js';

const debug = createDebug('sync-monorepo-packages:sync-package');

/**
 * These are the default fields synced from the monorepo root `package.json` to
 * its sub-packages.
 */
export const DEFAULT_FIELDS = Object.freeze([
  'keywords',
  'author',
  'repository',
  'license',
  'engines',
  'publishConfig',
] as const);

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
 * Options for {@link syncPackageJsons}.
 */
export interface SyncPackageJsonsOptions {
  /** If `true`, simulate changes without writing files. */
  dryRun?: boolean;
  /** Fields to copy from the source `package.json`. */
  fields?: (keyof PackageJson)[];
  /** Path to `lerna.json`, if any. */
  lerna?: string;
  /** Explicit destination package directories. */
  packages?: string[];
  /** Path to source `package.json` (or its directory). Defaults to nearest. */
  source?: string;
}

const pluralize = (word: string, count: number): string =>
  count === 1 ? word : `${word}s`;

const readPackageJson = async (pkgJsonPath: string): Promise<PackageJson> => {
  debug('reading %s', pkgJsonPath);
  return JSON.parse(await readFile(pkgJsonPath, 'utf8')) as PackageJson;
};

const writePackageJson = async (
  pkgJsonPath: string,
  pkg: PackageJson,
): Promise<void> => {
  await writeFile(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
};

/**
 * Resolves the path to the source `package.json`. If a directory path is given,
 * appends `package.json`. Returns `undefined` if no input is given.
 */
const resolveSourcePkgPath = (sourcePath?: string): string | undefined => {
  if (!sourcePath) {
    return undefined;
  }
  return basename(sourcePath) === PACKAGE_JSON
    ? sourcePath
    : join(sourcePath, PACKAGE_JSON);
};

/**
 * Synchronizes selected fields from a source `package.json` to all destination
 * packages in a monorepo.
 *
 * Yields a {@link PkgChangeResult} for each package that has (or would have)
 * been modified.
 *
 * @example
 *
 * ```ts
 * for await (const change of syncPackageJsons({dryRun: true})) {
 *   console.log(change.toString());
 * }
 * ```
 *
 * @param opts - Sync options
 */
export const syncPackageJsons = async function* ({
  dryRun = false,
  fields = [...DEFAULT_FIELDS],
  lerna: lernaJsonPath,
  packages = [],
  source: sourcePkgPathInput,
}: SyncPackageJsonsOptions = {}): AsyncGenerator<PkgChangeResult> {
  let sourcePkgPath = resolveSourcePkgPath(sourcePkgPathInput);

  if (!sourcePkgPath) {
    sourcePkgPath = await walkUp(PACKAGE_JSON, process.cwd());
  }

  if (!sourcePkgPath) {
    throw new SyncMonorepoPackagesError('Could not find source package.json');
  }

  debug('found source package.json at %s', sourcePkgPath);

  const sourcePkg = await readPackageJson(sourcePkgPath);
  const sourcePkgFields = pick(sourcePkg, ...fields);

  for await (const destPkgPath of findPackageJsons({
    lernaJsonPath,
    packages,
    sourcePkgPath,
  })) {
    const destPkg = await readPackageJson(destPkgPath);
    const destPkgFields = pick(destPkg, ...fields);

    const patch = createPatch(destPkgFields, sourcePkgFields);
    if (!patch.length) {
      continue;
    }

    // applyPatch mutates newPkg in place
    const newPkg = {...destPkg};
    applyPatch(newPkg, patch);

    const result = new PkgChangeResult(destPkgPath, patch, destPkg, newPkg);

    if (!dryRun) {
      await writePackageJson(destPkgPath, newPkg);
    }

    yield result;
  }
};

/**
 * Summarizes the results of a {@link syncPackageJsons} operation.
 *
 * @param results - Array of {@link PkgChangeResult} values
 * @returns A {@link Summary} describing what happened
 */
export const summarizePackageChanges = (
  results: PkgChangeResult[],
): Summary => {
  if (results.length) {
    return {
      success: `Synced ${results.length} package.json ${pluralize('file', results.length)}`,
    };
  }
  return {noop: 'No package.json changes needed; everything up-to-date!'};
};
