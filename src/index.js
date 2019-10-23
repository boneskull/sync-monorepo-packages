const logSymbols = require('log-symbols');
const pluralize = require('pluralize');
const {oneLine} = require('common-tags');
const {combineLatest, from, iif, of} = require('rxjs');
const {
  count,
  filter,
  groupBy,
  toArray,
  map,
  mergeMapTo,
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

const DEFAULT_FIELDS = [
  'keywords',
  'author',
  'repository',
  'license',
  'engines',
  'publishConfig'
];

class SyncMonorepoPackagesError extends Error {}

/**
 * Finds package.json files within one or more directories specified by `globs`
 * @param {string[]} globs - One ore more dirs or globs to dirs
 * @param {Partial<FindPackageJsonsByGlobsOptions>} [opts]
 */
function findPackageJsonsByGlobs(globs, {cwd = process.cwd()} = {}) {
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
 * @param {Partial<FindPackageJsonsFromLernaConfigOptions>} [opts] - Current working directory and path to lerna.json
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
          throw new SyncMonorepoPackagesError(
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
          ({packages}) => findPackageJsonsByGlobs(packages, {cwd: lernaRoot})
        )
      );
    }),
    filter(pkgPath => pkgPath !== sourcePkgPath)
  );
}

/**
 * Returns an Observable of paths to `package.json` files
 * @param {Partial<FindPackageJsonsOptions>} opts
 */
function findPackageJsons({
  packageDirs = [],
  cwd = process.cwd(),
  lernaJsonPath = '',
  sourcePkgPath = ''
} = {}) {
  return iif(
    () => Boolean(packageDirs.length),
    findPackageJsonsByGlobs(packageDirs, {cwd}),
    findPackageJSONsFromLernaConfig({cwd, lernaJsonPath, sourcePkgPath})
  );
}

/**
 *
 * @returns {OperatorFunction<string,PackageInfo>}
 */
function readPackageJson() {
  return pkgJsonPath$ =>
    pkgJsonPath$.pipe(
      mergeMap(pkgJsonPath =>
        from(readPkg({cwd: path.dirname(pkgJsonPath), normalize: false})).pipe(
          map(pkg => ({
            pkgPath: pkgJsonPath,
            pkg
          }))
        )
      )
    );
}

/**
 * Finds any fields in a source Observable of {@link PackageJson} objects
 * not matching the corresponding field in the `sourcePkg$` Observable.
 * @param {Observable<PackageJson>} sourcePkg$
 * @param {string[]} fields
 * @returns {OperatorFunction<PackageInfo,PackageChange>}
 */
function findChanges(sourcePkg$, fields) {
  return packageJson$ =>
    combineLatest(packageJson$, sourcePkg$).pipe(
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
 * @todo this is "not idiomatic"; somebody fix this
 * @returns {MonoTypeOperatorFunction<PackageChange>}
 */
function applyChanges() {
  return observable =>
    observable.pipe(
      toArray(),
      mergeMap(changes => {
        // this groups everything by pkgpath, so we can perform
        // a single write per package.json below
        const groupedChanges = changes.reduce(
          (perPkg, change) => ({
            ...perPkg,
            [change.pkgPath]: [...(perPkg[change.pkgPath] || []), change]
          }),
          {}
        );
        return from(
          Promise.all(
            Object.keys(groupedChanges).map(pkgPath => {
              const newPkg = groupedChanges[pkgPath].reduce(
                /**
                 * @param {PackageJson} newJson
                 * @param {PackageChange} change
                 */
                (newJson, change) => {
                  debug('%s: %O => %O', change.pkgPath, change.from, change.to);
                  return {...change.pkg, newJson, [change.field]: change.to};
                },
                {}
              );
              return writePkg(pkgPath, newPkg, {normalize: false});
            })
          )
        ).pipe(mergeMapTo(changes));
      })
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
  dryRun = false,
  fields = [],
  lerna: lernaJsonPath = ''
} = {}) {
  if (path.basename(sourcePkgPath) !== 'package.json') {
    sourcePkgPath = path.join(sourcePkgPath, 'package.json');
  }

  const sourcePkg$ = from(
    readPkg({
      cwd: normalizePkgPath(sourcePkgPath),
      normalize: false
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
exports.SyncMonorepoPackagesError = SyncMonorepoPackagesError;
exports.DEFAULT_FIELDS = DEFAULT_FIELDS;

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
 * @typedef {Object} FindPackageJsonsOptions
 * @property {string[]} packageDirs
 * @property {string} cwd
 * @property {string} lernaJsonPath
 * @property {string} sourcePkgPath
 */

/**
 * @typedef {Object} FindPackageJsonsFromLernaConfigOptions
 * @property {string[]} packageDirs
 * @property {string} cwd
 * @property {string} lernaJsonPath
 * @property {string} sourcePkgPath
 */

/**
 * @typedef {Object} FindPackageJsonsByGlobsOptions
 * @property {string} cwd
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
