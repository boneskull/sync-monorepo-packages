const findUp = require('find-up');
const glob = require('globby');
const {defer, from, iif, of} = require('rxjs');
const {
  filter,
  map,
  mergeAll,
  mergeMap,
  tap,
  distinct,
  mergeWith,
} = require('rxjs/operators');
const debug = require('debug')('sync-monorepo-packages:find-package');
const fs = require('fs-extra');
const path = require('path');

const PACKAGE_JSON = 'package.json';
const LERNA_JSON = 'lerna.json';

/**
 * @param {string} cwd
 * @returns {Observable<string[]>}
 */
function findWorkspaces(cwd = process.cwd()) {
  debug('Finding workspaces from %s', cwd);
  return from(findUp(PACKAGE_JSON, {cwd})).pipe(
    filter(Boolean),
    mergeMap((pkgPath) => from(fs.readJSON(pkgPath))),
    map(
      /**
       */ (pkg) => pkg.workspaces ?? []
    ),
    tap((value) => {
      debug('Found workspaces in %s: %s', PACKAGE_JSON, value);
    })
  );
}

/**
 * Finds a Lerna config file (lerna.json)
 * @param {FindLernaConfigOptions} [opts]
 * @returns {Observable<LernaInfo>}
 */
function findLernaConfig({cwd = process.cwd(), lernaJsonPath} = {}) {
  return iif(
    () => findLernaConfig.cache.has(`${cwd}:${lernaJsonPath}`),
    defer(() => of(findLernaConfig.cache.get(`${cwd}:${lernaJsonPath}`))),
    iif(
      () => Boolean(lernaJsonPath),
      of(/** @type {string} */ (lernaJsonPath)),
      from(findUp(LERNA_JSON, {cwd}))
    ).pipe(
      filter(Boolean),
      mergeMap((lernaConfigPath) =>
        from(fs.readJSON(lernaConfigPath)).pipe(
          map(
            /**
             * @param {LernaJson} lernaConfig
             */ (lernaConfig) => ({
              lernaConfig,
              lernaRoot: path.dirname(lernaConfigPath),
            })
          )
        )
      ),
      tap((lernaInfo) => {
        debug(
          'caching LernaInfo w/ key "%s:%s": %O',
          cwd,
          lernaJsonPath,
          lernaInfo
        );
        findLernaConfig.cache.set(`${cwd}:${lernaJsonPath}`, lernaInfo);
      })
    )
  );
}
findLernaConfig.cache = new Map();

/**
 * Finds one or more directories specified by `globs`
 * @param {string[]} globs - One ore more dirs or globs to dirs
 * @param {FindByGlobsOptions} [opts]
 */
function findDirectoriesByGlobs(globs, {cwd = process.cwd()} = {}) {
  return from(
    glob(globs, {
      cwd,
      onlyDirectories: true,
      expandDirectories: false,
    })
  ).pipe(mergeAll());
}

/**
 * Finds package.json files within one or more directories specified by `globs`
 * @param {string[]} globs - One ore more dirs or globs to dirs
 * @param {FindByGlobsOptions} [opts]
 */
function findPackageJsonsByGlobs(globs, {cwd = process.cwd()} = {}) {
  return findDirectoriesByGlobs(globs, {cwd}).pipe(
    mergeMap((dir) => from(glob(path.join(dir, PACKAGE_JSON)))),
    mergeAll(),
    tap((pkgPath) => {
      debug('Found package.json at %s', PACKAGE_JSON, pkgPath);
    })
  );
}

/**
 * Finds package.json files within packages as defined in a `lerna.json` file
 * @param {FindPackageJsonsFromLernaConfig} [opts] - Current working directory and path to lerna.json
 */
function findPackageJsonsFromLernaConfig({
  cwd = process.cwd(),
  lernaJsonPath = '',
  sourcePkgPath = '',
} = {}) {
  return findLernaConfig({lernaJsonPath, cwd}).pipe(
    filter(({lernaConfig}) => Boolean(lernaConfig.packages?.length)),
    mergeMap(({lernaRoot, lernaConfig}) =>
      findPackageJsonsByGlobs(lernaConfig.packages, {cwd: lernaRoot})
    ),
    filter((pkgPath) => pkgPath !== sourcePkgPath)
  );
}

/**
 * Returns an Observable of paths to `package.json` files
 * @param {FindPackageJsonsOptions} opts
 */
function findPackageJsons({
  packages: packageDirs = [],
  cwd = process.cwd(),
  lernaJsonPath = '',
  sourcePkgPath = '',
} = {}) {
  return iif(
    () => Boolean(packageDirs.length),
    findPackageJsonsByGlobs(packageDirs, {cwd}),
    findWorkspaces(sourcePkgPath || cwd).pipe(
      mergeMap((workspaces) => findPackageJsonsByGlobs(workspaces, {cwd})),
      mergeWith(
        findPackageJsonsFromLernaConfig({cwd, lernaJsonPath, sourcePkgPath})
      ),
      distinct()
    )
  );
}

exports.findWorkspaces = findWorkspaces;
exports.findLernaConfig = findLernaConfig;
exports.findDirectoriesByGlobs = findDirectoriesByGlobs;
exports.findPackageJsonsByGlobs = findPackageJsonsByGlobs;
exports.findPackageJsons = findPackageJsons;
exports.PACKAGE_JSON = PACKAGE_JSON;

/**
 * @typedef FindPackageJsonsFromLernaConfig
 * @property {string[]} [packageDirs]
 * @property {string} [cwd]
 * @property {string} [lernaJsonPath]
 * @property {string} [sourcePkgPath]
 */

/**
 * @typedef LernaInfo
 * @property {string} lernaRoot
 * @property {LernaJson} lernaConfig
 */

/**
 * @typedef FindLernaConfigOptions
 * @property {string} [cwd]
 * @property {string} [lernaJsonPath]
 */

/**
 * @typedef FindByGlobsOptions
 * @property {string} [cwd]
 */

/**
 * @template T
 * @typedef {import('rxjs').Observable<T>} Observable
 */

/**
 * @typedef LernaJson
 * @property {string[]} packages - Where Lerna finds packages
 */

/**
 * @typedef FindPackageJsonsOptions
 * @property {string[]} [packages]
 * @property {string} [cwd]
 * @property {string} [lernaJsonPath]
 * @property {string} [sourcePkgPath]
 */
