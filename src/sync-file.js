const pluralize = require('pluralize');
const {defer, merge, from, iif, of} = require('rxjs');

const fs = require('fs-extra');
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
  mergeAll,
  mergeMap,
  mergeWith,
} = require('rxjs/operators');
const path = require('path');
const glob = require('globby');
const debug = require('debug')('sync-monorepo-packages:sync-file');
const {createFileCopyResult} = require('./model');
const {SyncMonorepoPackagesError} = require('./error');
const {
  findLernaConfig,
  findDirectoriesByGlobs,
  findWorkspaces,
} = require('./find-package');

/**
 * For dry-run mode, if a file were to be copied, but force is
 * false, we should throw.
 * @param {FileCopyResult} copyInfo
 * @param {boolean} [force]
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
      catchError((err) => {
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
 * @returns {OperatorFunction<Readonly<FileCopyResult>,Summary>}
 */
exports.summarizeFileCopies = () => (copyInfo$) => {
  /**
   * @returns {OperatorFunction<Readonly<FileCopyResult>,{totalCopies: number, allSources: Set<string>}>}
   */
  const summary = () => (copyInfo$) =>
    copyInfo$.pipe(
      reduce(
        ({totalCopies, allSources}, {from}) => ({
          totalCopies: totalCopies + 1,
          allSources: allSources.add(from),
        }),
        {totalCopies: 0, allSources: new Set()}
      ),
      filter(({totalCopies}) => totalCopies > 0)
    );

  copyInfo$ = copyInfo$.pipe(share());
  const success$ = copyInfo$.pipe(
    filter((copyInfo) => Boolean(copyInfo.success)),
    summary(),
    map(({totalCopies, allSources}) => ({
      success: `Copied ${allSources.size} ${pluralize(
        'file',
        allSources.size
      )} to ${totalCopies} ${pluralize('package', totalCopies)}`,
    }))
  );

  const fail$ = copyInfo$.pipe(
    filter((copyInfo) => Boolean(copyInfo.err)),
    summary(),
    map(({totalCopies, allSources}) => ({
      fail: `Failed to copy ${allSources.size} ${pluralize(
        'file',
        allSources.size
      )} to ${totalCopies} ${pluralize(
        'package',
        totalCopies
      )}; use --verbose for details`,
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
    cwd = process.cwd(),
  } = {}
) => {
  debug(
    'syncFile called with force: %s, packages: %O, files: %O',
    force,
    packages,
    files
  );
  const file$ = from(files).pipe(
    throwIfEmpty(() => new SyncMonorepoPackagesError('No files to sync!')),
    mergeMap((file) =>
      from(glob(file)).pipe(
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
      filter(({lernaConfig}) => Boolean(lernaConfig.packages)),
      mergeMap(({lernaConfig, lernaRoot: cwd}) =>
        findDirectoriesByGlobs(lernaConfig.packages, {cwd})
      ),
      mergeWith(
        findWorkspaces(cwd).pipe(
          mergeMap((workspaces) => findDirectoriesByGlobs(workspaces, {cwd}))
        )
      )
    )
  ).pipe(
    toArray(),
    map((packageDirs) => ({cwd, packageDirs}))
  );

  return file$.pipe(
    mergeMap((srcFilePath) =>
      packageDirs$.pipe(
        mergeMap(({packageDirs, cwd}) =>
          // - we might not be at the package root
          // - we don't know where the packages are relative to us
          // - we don't know where we are relative to srcFilePath
          // - to that end, we need to compute the destination relative to
          //   `cwd` (the variable) and also relative to our actual cwd.
          // - display relative paths to the user for brevity
          //   (we can change this later)
          packageDirs.map((packageDir) =>
            createFileCopyResult(
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
        concatMap((copyInfo) => {
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
              from(fs.copy(copyInfo.from, copyInfo.to, {overwrite: force}))
            ).pipe(map(() => copyInfo))
          ).pipe(
            map((copyInfo) => copyInfo.withSuccess()),
            catchError((err) => {
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
 * @typedef {import('./model').FileCopyResult} FileCopyResult
 */

/**
 * @typedef Summary
 * @property {string} [fail] - Failure message
 * @property {string} [success] - Success message
 * @property {string} [noop] - No-op message
 */

/**
 * @typedef SyncFileOptions
 * @property {string} cwd
 * @property {string} lerna
 * @property {boolean} dryRun
 * @property {string[]} packages
 * @property {boolean} force
 */
