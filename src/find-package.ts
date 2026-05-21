import createDebug from 'debug';
import {readFile, stat} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';

const debug = createDebug('sync-monorepo-packages:find-package');

export const PACKAGE_JSON = 'package.json';
const LERNA_JSON = 'lerna.json';

/**
 * Information about a discovered lerna configuration.
 */
export interface LernaInfo {
  lernaConfig: LernaJson;
  lernaRoot: string;
}

/**
 * Shape of a `lerna.json` file (relevant fields only).
 */
interface LernaJson {
  packages?: string[];
}

/**
 * Walks up the directory tree from `startDir` looking for a file named
 * `filename`. Returns the absolute path to the first match, or `undefined` if
 * none is found.
 */
export const walkUp = async (
  filename: string,
  startDir: string,
): Promise<string | undefined> => {
  let dir = startDir;
  while (true) {
    const candidate = join(dir, filename);
    try {
      await stat(candidate);
      return candidate;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) {
        return undefined;
      }
      dir = parent;
    }
  }
};

const lernaCache = new Map<string, LernaInfo | undefined>();

/**
 * Finds and parses a `lerna.json` configuration file, starting from `cwd` and
 * walking up. Caches results by key to avoid redundant filesystem lookups.
 *
 * @param opts - Options
 */
export const findLernaConfig = async (opts?: {
  cwd?: string;
  lernaJsonPath?: string;
}): Promise<LernaInfo | undefined> => {
  const {cwd = process.cwd(), lernaJsonPath} = opts ?? {};
  const key = `${cwd}:${lernaJsonPath ?? ''}`;

  if (lernaCache.has(key)) {
    return lernaCache.get(key);
  }

  const lernaConfigPath = lernaJsonPath ?? (await walkUp(LERNA_JSON, cwd));
  if (!lernaConfigPath) {
    lernaCache.set(key, undefined);
    return undefined;
  }

  const lernaConfig = JSON.parse(
    await readFile(lernaConfigPath, 'utf8'),
  ) as LernaJson;
  const result: LernaInfo = {
    lernaConfig,
    lernaRoot: dirname(lernaConfigPath),
  };
  debug('caching LernaInfo w/ key "%s": %O', key, result);
  lernaCache.set(key, result);
  return result;
};

/**
 * Finds directory paths matching the given glob patterns. Yields paths relative
 * to `cwd`.
 *
 * @param globs - One or more directory glob patterns
 * @param cwd - Base directory for glob resolution
 */
export const findDirectoriesByGlobs = async function* (
  globs: string[],
  cwd = process.cwd(),
): AsyncGenerator<string> {
  // Node.js 22+ fs/promises glob
  const {glob} = await import('node:fs/promises');
  const seen = new Set<string>();
  for (const pattern of globs) {
    for await (const entry of glob(pattern, {cwd})) {
      if (seen.has(entry)) {
        continue;
      }
      seen.add(entry);
      try {
        const info = await stat(resolve(cwd, entry));
        if (info.isDirectory()) {
          yield entry;
        }
      } catch {
        // skip non-existent paths
      }
    }
  }
};

/**
 * Finds `package.json` files inside directories matched by the given globs.
 * Yields absolute paths.
 *
 * @param globs - One or more directory glob patterns
 * @param cwd - Base directory for glob resolution
 */
const findPackageJsonsByGlobs = async function* (
  globs: string[],
  cwd = process.cwd(),
): AsyncGenerator<string> {
  for await (const dir of findDirectoriesByGlobs(globs, cwd)) {
    const pkgJsonPath = resolve(cwd, dir, PACKAGE_JSON);
    try {
      await stat(pkgJsonPath);
      debug('Found package.json at %s', pkgJsonPath);
      yield pkgJsonPath;
    } catch {
      // no package.json in this dir
    }
  }
};

/**
 * Reads the workspaces field from the nearest `package.json` found by walking
 * up from `cwd`.
 *
 * @param cwd - Starting directory
 */
export const findWorkspaces = async (
  cwd = process.cwd(),
): Promise<string[]> => {
  debug('Finding workspaces from %s', cwd);
  const pkgPath = await walkUp(PACKAGE_JSON, cwd);
  if (!pkgPath) {
    return [];
  }
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8')) as {
    workspaces?: string[];
  };
  const workspaces = pkg.workspaces ?? [];
  debug('Found workspaces in %s: %O', PACKAGE_JSON, workspaces);
  return workspaces;
};

/**
 * Finds all destination `package.json` files for the monorepo.
 *
 * If `packages` is provided, globs those directories directly. Otherwise,
 * combines workspaces and lerna package discovery (deduplicating).
 *
 * Yields absolute paths.
 *
 * @param opts - Discovery options
 */
export const findPackageJsons = async function* (opts?: {
  cwd?: string;
  lernaJsonPath?: string;
  packages?: string[];
  sourcePkgPath?: string;
}): AsyncGenerator<string> {
  const {
    cwd = process.cwd(),
    lernaJsonPath,
    packages = [],
    sourcePkgPath,
  } = opts ?? {};

  if (packages.length) {
    yield* findPackageJsonsByGlobs(packages, cwd);
    return;
  }

  const seen = new Set<string>();
  const workspacesCwd = sourcePkgPath ? dirname(sourcePkgPath) : cwd;
  const workspaces = await findWorkspaces(workspacesCwd);

  if (workspaces.length) {
    for await (const pkgPath of findPackageJsonsByGlobs(workspaces, cwd)) {
      if (!seen.has(pkgPath)) {
        seen.add(pkgPath);
        yield pkgPath;
      }
    }
  }

  for await (const pkgPath of findPackageJsonsFromLernaConfig({
    cwd,
    lernaJsonPath,
    sourcePkgPath,
  })) {
    if (!seen.has(pkgPath)) {
      seen.add(pkgPath);
      yield pkgPath;
    }
  }
};

/**
 * Finds `package.json` files for lerna-defined packages. Yields absolute paths,
 * excluding the source package itself.
 */
const findPackageJsonsFromLernaConfig = async function* (opts?: {
  cwd?: string;
  lernaJsonPath?: string;
  sourcePkgPath?: string;
}): AsyncGenerator<string> {
  const {cwd = process.cwd(), lernaJsonPath, sourcePkgPath} = opts ?? {};
  const lernaInfo = await findLernaConfig({cwd, lernaJsonPath});
  if (!lernaInfo?.lernaConfig.packages?.length) {
    return;
  }

  for await (const pkgPath of findPackageJsonsByGlobs(
    lernaInfo.lernaConfig.packages,
    lernaInfo.lernaRoot,
  )) {
    if (pkgPath !== sourcePkgPath) {
      yield pkgPath;
    }
  }
};
