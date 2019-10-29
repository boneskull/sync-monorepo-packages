const pluralize = require('pluralize');
const {oneLine} = require('common-tags');
const {defer, concat, from, iif, of} = require('rxjs');
const {promises: fs} = require('fs');
const cp = require('cp-file');
const {
  catchError,
  defaultIfEmpty,
  concatMap,
  throwIfEmpty,
  filter,
  reduce,
  concatAll,
  concatMapTo,
  toArray,
  share,
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
const writePkg = require('write-pkg');
const debug = require('debug')('sync-monorepo-packages');
const {createCopyInfo, createPackageChange} = require('./model');

const PACKAGE_JSON = 'package.json';

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
 * Finds one or more directories specified by `globs`
 * @param {string[]} globs - One ore more dirs or globs to dirs
 * @param {Partial<FindByGlobsOptions>} [opts]
 */
function findDirectoriesByGlobs(globs, {cwd = process.cwd()} = {}) {
  return from(
    globby(globs, {
      cwd,
      onlyDirectories: true,
      expandDirectories: false
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
    mergeMap(dir => from(globby(path.join(dir, PACKAGE_JSON)))),
    mergeAll(),
    tap(pkgPath => {
      debug('found %s at %s', PACKAGE_JSON, pkgPath);
    })
  );
}

/**
 * Finds a Lerna config file (lerna.json)
 * @param {Partial<FindLernaConfigOptions>} [opts]
 * @returns {Observable<LernaInfo>}
 */
function findLernaConfig({cwd = process.cwd(), lernaJsonPath = ''} = {}) {
  return iif(
    () => findLernaConfig.cache.has(`${cwd}:${lernaJsonPath}`),
    defer(() => of(findLernaConfig.cache.get(`${cwd}:${lernaJsonPath}`))),
    iif(
      () => Boolean(lernaJsonPath),
      of(lernaJsonPath),
      from(findUp('lerna.json', {cwd})).pipe(
        tap(lernaConfigPath => {
          if (!lernaConfigPath) {
            throw new SyncMonorepoPackagesError(
              oneLine`Could not find lerna.json, and no package locations
              provided. Use option "--lerna" to provide path to lerna.json,
              or "--packages" option to provide package path(s).`
            );
          }
          debug(`found lerna config at %s`, lernaConfigPath);
        })
      )
    ).pipe(
      mergeMap(lernaConfigPath =>
        from(loadJsonFile(lernaConfigPath)).pipe(
          map(
            /**
             * @param {LernaJson} lernaConfig
             */ lernaConfig => ({
              lernaConfig,
              lernaRoot: path.dirname(lernaConfigPath)
            })
          )
        )
      ),
      tap(lernaInfo => {
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
 * Finds package.json files within packages as defined in a `lerna.json` file
 * @param {Partial<FindPackageJsonsFromLernaConfig>} [opts] - Current working directory and path to lerna.json
 */
function findPackageJsonsFromLernaConfig({
  cwd = process.cwd(),
  lernaJsonPath = '',
  sourcePkgPath = ''
} = {}) {
  return findLernaConfig({lernaJsonPath, cwd}).pipe(
    mergeMap(({lernaRoot, lernaConfig}) =>
      findPackageJsonsByGlobs(lernaConfig.packages, {cwd: lernaRoot})
    ),
    filter(pkgPath => pkgPath !== sourcePkgPath)
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
  sourcePkgPath = ''
} = {}) {
  return iif(
    () => Boolean(packageDirs.length),
    findPackageJsonsByGlobs(packageDirs, {cwd}),
    findPackageJsonsFromLernaConfig({cwd, lernaJsonPath, sourcePkgPath})
  );
}

/**
 *
 * @returns {OperatorFunction<string,Readonly<PackageInfo>>}
 */
function readPackageJson() {
  return pkgJsonPath$ =>
    pkgJsonPath$.pipe(
      mergeMap(pkgJsonPath =>
        from(readPkg({cwd: path.dirname(pkgJsonPath), normalize: false})).pipe(
          map(pkg =>
            Object.freeze({
              pkgPath: pkgJsonPath,
              pkg
            })
          )
        )
      )
    );
}

/**
 * Finds any fields in a source Observable of {@link PackageJson} objects
 * not matching the corresponding field in the `sourcePkg$` Observable.
 * @param {Observable<PackageJson>} sourcePkg$
 * @param {string[]} fields
 * @returns {OperatorFunction<PackageInfo,Readonly<PackageChange>>}
 */
function findChanges(sourcePkg$, fields) {
  return packageInfo$ =>
    packageInfo$.pipe(
      mergeMap(({pkg, pkgPath}) =>
        sourcePkg$.pipe(
          mergeMap(sourcePkg =>
            from(fields).pipe(
              filter(field => !deepEqual(pkg[field], sourcePkg[field])),
              map(field =>
                createPackageChange(
                  pkg[field],
                  sourcePkg[field],
                  pkgPath,
                  field,
                  pkg
                )
              )
            )
          )
        )
      )
    );
}

/**
 * Applies changes to a package.json
 * @todo this is "not idiomatic"; somebody fix this
 * @returns {MonoTypeOperatorFunction<Readonly<PackageChange>>}
 */
function applyChanges(dryRun = false) {
  return observable =>
    observable.pipe(
      toArray(),
      concatMap(changes => {
        // this groups everything by pkgpath, so we can perform
        // a single write per package.json below
        const groupedChanges = changes.reduce(
          (perPkg, change) => ({
            ...perPkg,
            [change.pkgPath]: [...(perPkg[change.pkgPath] || []), change]
          }),
          {}
        );
        // note that even though we're grouping to reduce file
        // writes, we need to have a 1:1 input/output of values.
        // this is what we use `newChanges` for below.
        return Object.keys(groupedChanges).map(pkgPath => {
          const newChanges = [];
          const pkgChange = groupedChanges[pkgPath].reduce(
            /**
             * @param {PackageChange} nextPkgChange
             * @param {PackageChange} pkgChange
             */
            (nextPkgChange, pkgChange) => {
              debug(
                '%s: %O => %O',
                pkgChange.pkgPath,
                pkgChange.from,
                pkgChange.to
              );

              let draftPkgChange;
              // if the "to" value--corresponding to the source field value--is
              // undefined, we want to just remove the value from the
              // destination
              if (nextPkgChange.to === undefined) {
                draftPkgChange = {...pkgChange.pkg, ...pkgChange.newPkg};
                delete draftPkgChange[pkgChange.field];
              } else {
                draftPkgChange = {
                  ...nextPkgChange.pkg,
                  ...nextPkgChange.newPkg,
                  [pkgChange.field]: pkgChange.to
                };
              }
              const newPkgChange = pkgChange.withNewPackage(draftPkgChange);
              newChanges.push(newPkgChange);
              return newPkgChange;
            }
          );
          return iif(
            () => dryRun,
            newChanges,
            defer(() =>
              from(writePkg(pkgPath, pkgChange.newPkg, {normalize: false}))
            ).pipe(concatMapTo(newChanges))
          );
        });
      }),
      concatAll()
    );
}

/**
 * Inputs changes and outputs summaries of what happened
 * @returns {OperatorFunction<Readonly<PackageChange>,string>}
 */
exports.summarizePackageChanges = () => pkgChange$ =>
  pkgChange$.pipe(
    filter(pkgChange => Boolean(pkgChange.newPkg)),
    reduce(
      ({totalChanges, allPackages}, pkgChange) => ({
        totalChanges: totalChanges + 1,
        allPackages: allPackages.add(pkgChange.pkgPath)
      }),
      {totalChanges: 0, allPackages: new Set()}
    ),
    map(
      ({totalChanges, allPackages}) =>
        `Changed ${totalChanges} ${pluralize('field', totalChanges)} across ${
          allPackages.size
        } files`
    )
  );

/**
 * Provide a summary of the file copies made
 * @returns {OperatorFunction<Readonly<CopyInfo>,string>}
 */
exports.summarizeFileCopies = () => copyInfo$ => {
  const summary = () => copyInfo$ =>
    copyInfo$.pipe(
      reduce(
        ({totalCopies, allSources}, {from}) => ({
          totalCopies: totalCopies + 1,
          allSources: allSources.add(from)
        }),
        {totalCopies: 0, allSources: new Set()}
      ),
      filter(({totalCopies}) => totalCopies > 0)
    );

  copyInfo$ = copyInfo$.pipe(share());
  const success$ = copyInfo$.pipe(
    filter(copyInfo => copyInfo.success),
    summary(),
    map(({totalCopies, allSources}) => ({
      successMsg: `Copied ${allSources.size} ${pluralize(
        'file',
        allSources.size
      )} to ${totalCopies} ${pluralize('package', totalCopies)}`
    }))
  );

  const fail$ = copyInfo$.pipe(
    filter(copyInfo => Boolean(copyInfo.err)),
    summary(),
    map(({totalCopies, allSources}) => ({
      failMsg: `Failed to copy ${allSources.size} ${pluralize(
        'file',
        allSources.size
      )} to ${totalCopies} ${pluralize(
        'package',
        totalCopies
      )}; use --verbose for details`
    }))
  );

  return concat(success$, fail$).pipe(defaultIfEmpty('No files copied.'));
};

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
exports.syncPackageJsons = ({
  sourcePkgPath = '',
  packages: packageDirs = [],
  dryRun = false,
  fields = [],
  lerna: lernaJsonPath = ''
} = {}) => {
  if (sourcePkgPath && path.basename(sourcePkgPath) !== 'package.json') {
    sourcePkgPath = path.join(sourcePkgPath, 'package.json');
  }

  const sourcePkg$ = iif(
    () => Boolean(sourcePkgPath),
    of(sourcePkgPath),
    from(findUp('package.json')).pipe(
      tap(pkgJsonPath => {
        debug('found source package.json at %s', pkgJsonPath);
      })
    )
  ).pipe(
    mergeMap(sourcePkgPath =>
      from(
        readPkg({
          cwd: normalizePkgPath(sourcePkgPath),
          normalize: false
        })
      )
    ),
    share()
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
  return changes$.pipe(applyChanges(dryRun));
};

/**
 * For dry-run mode, if a file were to be copied, but force is
 * false, we should throw.
 * @param {CopyInfo} copyInfo
 * @param {boolean?} force
 */
function dryRunTestFile(copyInfo, force = false) {
  return iif(
    () => force,
    of(copyInfo),
    from(fs.stat(copyInfo.to)).pipe(
      map(() => {
        const err = new Error();
        err.code = 'EEXIST';
        throw err;
      }),
      catchError(err => {
        if (err.code === 'ENOENT') {
          return of(copyInfo);
        }
        throw err;
      })
    )
  );
}

/**
 * Synchronize source file(s) to packages
 * @param {string[]} [files] - Source file(s)
 * @param {Partial<SyncFileOptions>} [opts]
 */
exports.syncFile = (
  files = [],
  {
    packageDirs = [],
    dryRun = false,
    lerna: lernaJsonPath = '',
    force = false,
    cwd = process.cwd()
  } = {}
) => {
  debug('syncFile called with force: %s', force);
  const file$ = from(files).pipe(
    throwIfEmpty(() => new SyncMonorepoPackagesError('No files to sync!')),
    mergeMap(file =>
      from(globby(file)).pipe(
        mergeAll(),
        throwIfEmpty(
          () =>
            new SyncMonorepoPackagesError(
              `Could not find any files matching glob "${file}"`
            )
        )
      )
    )
  );

  const packageDirs$ = iif(
    () => Boolean(packageDirs.length),
    from(packageDirs),
    findLernaConfig({lernaJsonPath}).pipe(
      mergeMap(({lernaConfig, lernaRoot: cwd}) =>
        findDirectoriesByGlobs(lernaConfig.packages, {cwd})
      )
    )
  ).pipe(
    toArray(),
    map(packageDirs => ({cwd, packageDirs})),
    share()
  );

  return file$.pipe(
    mergeMap(srcFilePath =>
      packageDirs$.pipe(
        mergeMap(({packageDirs, cwd}) =>
          // - we might not be at the package root
          // - we don't know where the packages are relative to us
          // - we don't know where we are relative to srcFilePath
          // - to that end, we need to compute the destination relative to
          //   `cwd` (the variable) and also relative to our actual cwd.
          // - display relative paths to the user for brevity
          //   (we can change this later)
          packageDirs.map(packageDir =>
            createCopyInfo(
              srcFilePath,
              path.relative(
                process.cwd(),
                path.join(
                  path.resolve(cwd, packageDir),
                  path.relative(path.resolve(process.cwd(), cwd), srcFilePath)
                )
              )
            )
          )
        ),
        concatMap(copyInfo => {
          debug(`attempting to copy ${copyInfo.from} to ${copyInfo.to}`);
          return iif(
            () => dryRun,
            dryRunTestFile(copyInfo, force),
            defer(() =>
              from(cp(copyInfo.from, copyInfo.to, {overwrite: force}))
            ).pipe(mapTo(copyInfo))
          ).pipe(
            catchError(err => {
              if (err.code === 'EEXIST') {
                return of(
                  copyInfo.withError(
                    new SyncMonorepoPackagesError(
                      `Refusing to overwrite existing file ${copyInfo.to}; use --force to overwrite`
                    )
                  )
                );
              }
              throw err;
            })
          );
        })
      )
    )
  );
};

exports.SyncMonorepoPackagesError = SyncMonorepoPackagesError;
exports.DEFAULT_FIELDS = DEFAULT_FIELDS;

/**
 * @typedef {Object} LernaJson
 * @property {string[]} packages - Where Lerna finds packages
 */

/**
 * @typedef {Object} PackageInfo
 * @property {import('type-fest').PackageJson} pkg - Package json for package
 * @property {string} pkgPath - Path to package
 */

/**
 * @typedef {Object} SyncFileOptions
 * @property {string} cwd
 * @property {string} lerna
 * @property {boolean} dryRun
 * @property {string[]} packageDirs
 * @property {boolean} force
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
 * @typedef {Object} FindPackageJsonsFromLernaConfig
 * @property {string[]} packageDirs
 * @property {string} cwd
 * @property {string} lernaJsonPath
 * @property {string} sourcePkgPath
 */

/**
 * @typedef {Object} LernaInfo
 * @property {string} lernaRoot
 * @property {LernaJson} lernaConfig
 */

/**
 * @typedef {Object} FindLernaConfigOptions
 * @property {string} cwd
 * @property {string} lernaJsonPath
 */

/**
 * @typedef {Object} FindByGlobsOptions
 * @property {string} cwd
 */

/**
 * @template T,U
 * @typedef {import('rxjs').OperatorFunction<T,U>} OperatorFunction
 */

/**
 * @typedef {import('type-fest').PackageJson} PackageJson
 */

/**
 * @template T
 * @typedef {import('rxjs').MonoTypeOperatorFunction<T>} MonoTypeOperatorFunction
 */

/**
 * @template T
 * @typedef {import('rxjs').Observable<T>} Observable
 */

/**
 * @typedef {import('./model').PackageChange} PackageChange
 */
