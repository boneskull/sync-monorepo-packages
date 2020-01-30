const pluralize = require('pluralize');
const {defer, merge, from, iif, of} = require('rxjs');

const cp = require('cp-file');
const {
  catchError,
  defaultIfEmpty,
  concatMap,
  throwIfEmpty,
  filter,
  reduce,
  toArray,
  share,
  map,
  mapTo,
  mergeAll,
  mergeMap
} = require('rxjs/operators');
const path = require('path');
const globby = require('globby');
const debug = require('debug')('sync-monorepo-packages:sync-file');
const {createCopyInfo} = require('./model');
const {SyncMonorepoPackagesError} = require('./error');
const {promises: fs} = require('fs');
const {findLernaConfig, findDirectoriesByGlobs} = require('./find-package');

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
    defer(() => from(fs.stat(copyInfo.to))).pipe(
      map(() => {
        /**
         * @type {any}
         */
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
 * Provide a summary of the file copies made
 * @returns {OperatorFunction<Readonly<CopyInfo>,Summary>}
 */
exports.summarizeFileCopies = () => copyInfo$ => {
  /**
   * @returns {OperatorFunction<Readonly<CopyInfo>,{totalCopies: number, allSources: Set<string>}>}
   */
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
    filter(copyInfo => Boolean(copyInfo.success)),
    summary(),
    map(({totalCopies, allSources}) => ({
      success: `Copied ${allSources.size} ${pluralize(
        'file',
        allSources.size
      )} to ${totalCopies} ${pluralize('package', totalCopies)}`
    }))
  );

  const fail$ = copyInfo$.pipe(
    filter(copyInfo => Boolean(copyInfo.err)),
    summary(),
    map(({totalCopies, allSources}) => ({
      fail: `Failed to copy ${allSources.size} ${pluralize(
        'file',
        allSources.size
      )} to ${totalCopies} ${pluralize(
        'package',
        totalCopies
      )}; use --verbose for details`
    }))
  );
  return merge(success$, fail$).pipe(
    defaultIfEmpty(
      /**
       * @type {Summary}
       */
      ({noop: 'No files copied.'})
    )
  );
};

/**
 * Synchronize source file(s) to packages
 * @param {string[]} [files] - Source file(s)
 * @param {Partial<SyncFileOptions>} [opts]
 */
exports.syncFile = (
  files = [],
  {
    packages = [],
    dryRun = false,
    lerna: lernaJsonPath = '',
    force = false,
    cwd = process.cwd()
  } = {}
) => {
  debug('syncFile called with force: %s & packages: %O', force, packages);
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
    () => Boolean(packages.length),
    from(packages),
    findLernaConfig({lernaJsonPath}).pipe(
      mergeMap(({lernaConfig, lernaRoot: cwd}) =>
        findDirectoriesByGlobs(lernaConfig.packages, {cwd})
      )
    )
  ).pipe(
    toArray(),
    map(packageDirs => ({cwd, packageDirs}))
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
          debug(
            'attempting to copy %s to %s (overwrite: %s)',
            copyInfo.from,
            copyInfo.to,
            force
          );
          return iif(
            () => dryRun,
            dryRunTestFile(copyInfo, force),
            defer(() =>
              from(cp(copyInfo.from, copyInfo.to, {overwrite: force}))
            ).pipe(mapTo(copyInfo))
          ).pipe(
            map(copyInfo => copyInfo.withSuccess()),
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

/**
 * @template T,U
 * @typedef {import('rxjs').OperatorFunction<T,U>} OperatorFunction
 */

/**
 * @typedef {import('./model').CopyInfo} CopyInfo
 */

/**
 * @typedef {Object} Summary
 * @property {string} [fail] - Failure message
 * @property {string} [success] - Success message
 * @property {string} [noop] - No-op message
 */

/**
 * @typedef {Object} SyncFileOptions
 * @property {string} cwd
 * @property {string} lerna
 * @property {boolean} dryRun
 * @property {string[]} packages
 * @property {boolean} force
 */
