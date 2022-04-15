const findUp = require('find-up');
const glob = require('globby');
const {filterNullish} = require('./util');
const {defer, from, iif, of} = require('rxjs');
const {filter, map, mergeAll, mergeMap, tap} = require('rxjs/operators');
const {SyncMonorepoPackagesError} = require('./error');
const debug = require('debug')('sync-monorepo-packages:find-package');
const fs = require('fs-extra');
const path = require('path');

const PACKAGE_JSON = 'package.json';

/**
 * Finds a Lerna config file (lerna.json)
 * @param {Partial<FindLernaConfigOptions>} [opts]
 * @returns {Observable<LernaInfo>}
 */
function findLernaConfig({cwd = process.cwd(), lernaJsonPath} = {}) {
  return iif(
    () => findLernaConfig.cache.has(`${cwd}:${lernaJsonPath}`),
    defer(() => of(findLernaConfig.cache.get(`${cwd}:${lernaJsonPath}`))),
    iif(
      () => Boolean(lernaJsonPath),
      of(/** @type {string} */ (lernaJsonPath)),
      from(findUp('lerna.json', {cwd})).pipe(
        tap((lernaConfigPath) => {
          if (!lernaConfigPath) {
            throw new SyncMonorepoPackagesError(
              `Could not find lerna.json, and no package locations provided. Use option "--lerna" to provide path to lerna.json, or "--packages" option to provide package path(s).`
            );
          }
          debug(`found lerna config at %s`, lernaConfigPath);
        }),
        filterNullish()
      )
    ).pipe(
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
 * @param {Partial<FindByGlobsOptions>} [opts]
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
 * @param {Partial<FindByGlobsOptions>} [opts]
 */
function findPackageJsonsByGlobs(globs, {cwd = process.cwd()} = {}) {
  return findDirectoriesByGlobs(globs, {cwd}).pipe(
    mergeMap((dir) => from(glob(path.join(dir, PACKAGE_JSON)))),
    mergeAll(),
    tap((pkgPath) => {
      debug('found %s at %s', PACKAGE_JSON, pkgPath);
    })
  );
}

/**
 * Finds package.json files within packages as defined in a `lerna.json` file
 * @param {Partial<FindPackageJsonsFromLernaConfig>} [opts] - Current working directory and path to lerna.json
 */
function findPackageJsonsFromLernaConfig({
  cwd = process.cwd(),
  lernaJsonPath = '',
  sourcePkgPath = '',
} = {}) {
  return findLernaConfig({lernaJsonPath, cwd}).pipe(
    mergeMap(({lernaRoot, lernaConfig}) =>
      findPackageJsonsByGlobs(lernaConfig.packages, {cwd: lernaRoot})
    ),
    filter((pkgPath) => pkgPath !== sourcePkgPath)
  );
}

/**
 * Returns an Observable of paths to `package.json` files
 * @param {Partial<FindPackageJsonsOptions>} opts
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
    findPackageJsonsFromLernaConfig({cwd, lernaJsonPath, sourcePkgPath})
  );
}

exports.findLernaConfig = findLernaConfig;
exports.findDirectoriesByGlobs = findDirectoriesByGlobs;
exports.findPackageJsonsByGlobs = findPackageJsonsByGlobs;
exports.findPackageJsons = findPackageJsons;

/**
 * @typedef FindPackageJsonsFromLernaConfig
 * @property {string[]} packageDirs
 * @property {string} cwd
 * @property {string} lernaJsonPath
 * @property {string} sourcePkgPath
 */

/**
 * @typedef LernaInfo
 * @property {string} lernaRoot
 * @property {LernaJson} lernaConfig
 */

/**
 * @typedef FindLernaConfigOptions
 * @property {string} cwd
 * @property {string} lernaJsonPath
 */

/**
 * @typedef FindByGlobsOptions
 * @property {string} cwd
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
 * @property {string[]} packages
 * @property {string} cwd
 * @property {string} lernaJsonPath
 * @property {string} sourcePkgPath
 */
