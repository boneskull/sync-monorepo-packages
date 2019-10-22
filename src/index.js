const logSymbols = require('log-symbols');
const pluralize = require('pluralize');
const {oneLine} = require('common-tags');
const {combineLatest, from, iif, of} = require('rxjs');
const {
  count,
  filter,
  groupBy,
  map,
  mapTo,
  mergeAll,
  mergeMap,
  tap
} = require('rxjs/operators');
const findUp = require('find-up');
const path = require('path');
const loadJsonFile = require('load-json-file');
const globby = require('globby');
const deepEqual = require('deep-equal');
const readPkg = require('read-pkg');
const {inspect} = require('util');
const writePkg = require('write-pkg');
const debug = require('debug')('sync-monorepo-packages');

/**
 * Finds package.json files within one or more directories specified by `globs`
 * @param {string[]} globs - One ore more dirs or globs to dirs
 * @param {{cwd?: string}} [opts] - Current working directory
 */
function findPackageJSONsByGlobs(globs, {cwd = process.cwd()} = {}) {
  return from(
    globby(globs, {
      cwd,
      onlyDirectories: true,
      expandDirectories: false
    })
  ).pipe(
    mergeAll(),
    mergeMap(dir => from(globby(path.join(dir, 'package.json')))),
    mergeAll(),
    tap(pkgPath => {
      debug(`found ${pkgPath}`);
    })
  );
}

/**
 * Finds package.json files within packages as defined in a `lerna.json` file
 * @param {{cwd?: string, lernaJsonPath?: string, sourcePkgPath?: string}} [opts] - Current working directory and path to lerna.json
 */
function findPackageJSONsFromLernaConfig({
  cwd = process.cwd(),
  lernaJsonPath = '',
  sourcePkgPath = ''
} = {}) {
  return iif(
    () => Boolean(lernaJsonPath),
    of(lernaJsonPath),
    from(findUp('lerna.json', {cwd})).pipe(
      tap(lernaConfigPath => {
        if (!lernaConfigPath) {
          throw new Error(
            oneLine`Could not find lerna.json, and no package locations
            provided. Use "lerna" option to provide path to
            lerna.json, or "packages" option to provide one or more paths.`
          );
        }
      })
    )
  ).pipe(
    mergeMap(lernaConfigPath => {
      const lernaRoot = path.dirname(lernaConfigPath);
      return from(loadJsonFile(lernaConfigPath)).pipe(
        mergeMap(
          /**
           * @param {LernaJSON} arg
           */
          ({packages}) => findPackageJSONsByGlobs(packages, {cwd: lernaRoot})
        )
      );
    }),
    filter(pkgPath => pkgPath !== sourcePkgPath)
  );
}

/**
 * @param {{packageDirs?: string[], cwd?: string, lernaJsonPath?: string, sourcePkgPath?: string}} opts
 */
function findPackageJsons({
  packageDirs = [],
  cwd = process.cwd(),
  lernaJsonPath = '',
  sourcePkgPath = ''
} = {}) {
  return iif(
    () => Boolean(packageDirs.length),
    findPackageJSONsByGlobs(packageDirs, {cwd}),
    findPackageJSONsFromLernaConfig({cwd, lernaJsonPath, sourcePkgPath})
  );
}

/**
 *
 * @returns {OperatorFunction<string,PackageInfo>}
 */
function readPackageJson() {
  return observable =>
    observable.pipe(
      mergeMap(pkgJsonPath => {
        return from(readPkg({cwd: path.dirname(pkgJsonPath)})).pipe(
          map(pkg => ({
            pkgPath: pkgJsonPath,
            pkg
          }))
        );
      })
    );
}

/**
 *
 * @param {Observable<PackageJson>} sourcePkg$
 * @param {string[]} fields
 * @returns {OperatorFunction<PackageInfo,PackageChange>}
 */
function findChanges(sourcePkg$, fields) {
  return observable =>
    combineLatest(observable, sourcePkg$).pipe(
      mergeMap(([{pkg, pkgPath}, sourcePkg]) =>
        from(fields).pipe(
          filter(field => !deepEqual(pkg[field], sourcePkg[field])),
          map(field => ({
            from: pkg[field],
            to: sourcePkg[field],
            field,
            pkgPath,
            pkg
          }))
        )
      )
    );
}

/**
 * Applies changes to a package.json
 * @returns {MonoTypeOperatorFunction<PackageChange>}
 */
function applyChanges() {
  return observable =>
    observable.pipe(
      mergeMap(change =>
        from(
          writePkg(
            change.pkgPath,
            {...change.pkg, [change.field]: change.to},
            {normalize: false}
          )
        ).pipe(mapTo(change))
      )
    );
}

/**
 *
 * @param {any?} value
 */
function inspectChangeValue(value) {
  return value === undefined
    ? '(undefined)'
    : inspect(value, {
        colors: true,
        compact: true,
        breakLength: Infinity
      });
}

/**
 * @returns {OperatorFunction<PackageChange,string>}
 */
function serializeChanges() {
  return observable =>
    observable.pipe(
      map(change => {
        const from = inspectChangeValue(change.from);
        const to = inspectChangeValue(change.to);
        return `${logSymbols.info} ${change.pkgPath}: Synchronized field "${change.field}":
  ${from} => ${to}
`;
      })
    );
}

/**
 * Inputs changes and outputs summaries of what happened
 * @returns {OperatorFunction<PackageChange,string>}
 */
function summarizeChanges() {
  return observable =>
    observable.pipe(
      groupBy(change => change.pkgPath),
      mergeMap(group$ =>
        group$.pipe(
          count(),
          map(
            count =>
              `${group$.key}: Changed ${count} ${pluralize('field', count)}`
          )
        )
      )
    );
}

/**
 * Strip 'package.json' from a path to get the dirname; to be handed
 * to `read-pkg`
 * @param {string} pkgPath - User-supplied package path to normalize
 */
function normalizePkgPath(pkgPath) {
  return path.basename(pkgPath) === 'package.json'
    ? path.dirname(pkgPath)
    : pkgPath;
}

/**
 * Given a source package.json and a list of package directories, sync fields from source to destination(s)
 * @param {Partial<SyncPackageJsonsOptions>} [opts]
 */
function syncPackageJsons({
  sourcePkgPath = path.join(process.cwd(), 'package.json'),
  packageDirs = [],
  dryRun = true,
  fields = [],
  lerna: lernaJsonPath = ''
} = {}) {
  if (path.basename(sourcePkgPath) !== 'package.json') {
    sourcePkgPath = path.join(sourcePkgPath, 'package.json');
  }

  const sourcePkg$ = from(
    readPkg({
      cwd: normalizePkgPath(sourcePkgPath)
    })
  );

  // get changes
  const changes$ = findPackageJsons({
    lernaJsonPath,
    packageDirs,
    sourcePkgPath
  }).pipe(
    readPackageJson(),
    findChanges(sourcePkg$, fields)
  );

  // decide if we should apply them
  return iif(() => dryRun, changes$, changes$.pipe(applyChanges()));
}

exports.serializeChanges = serializeChanges;
exports.syncPackageJsons = syncPackageJsons;
exports.findPackageJsons = findPackageJsons;
exports.readPackageJson = readPackageJson;
exports.printChanges = serializeChanges;
exports.summarizeChanges = summarizeChanges;

/**
 * @typedef {Object} LernaJSON
 * @property {string[]} packages - Where Lerna finds packages
 */

/**
 * @typedef {Object} PackageInfo
 * @property {import('type-fest').PackageJson} pkg - Package json for package
 * @property {string} pkgPath - Path to package
 */

/**
 * @typedef {Object} SyncPackageJsonsOptions
 * @property {string} sourcePkgPath - Path to source package.json
 * @property {string[]} packageDirs - Where to find packages; otherwise use Lerna
 * @property {boolean} dryRun - If `true`, print changes and exit
 * @property {string[]} fields - Fields to copy
 * @property {string} lerna - Path to lerna.json
 */

/**
 * A change to be applied to a package.json
 * @typedef {Object} PackageChange
 * @property {any} from
 * @property {any} to
 * @property {string} pkgPath
 * @property {string} field
 * @property {PackageJson} pkg
 */

/**
 * @template T,U
 * @typedef {import('rxjs').OperatorFunction} OperatorFunction
 */

/**
 * @typedef {import('type-fest').PackageJson} PackageJson
 */

/**
 * @template T
 * @typedef {import('rxjs').MonoTypeOperatorFunction} MonoTypeOperatorFunction
 */

/**
 * @template T
 * @typedef {import('rxjs').Observable} Observable
 */
