const pluralize = require('pluralize');
const {defer, from, iif, of} = require('rxjs');
const {applyPatch, createPatch} = require('rfc6902');
const {pick, filterNullish} = require('./util');
const {count, share, map, mapTo, mergeMap, tap} = require('rxjs/operators');
const findUp = require('find-up');
const path = require('path');
const readPkg = require('read-pkg');
const writePkg = require('write-pkg');
const debug = require('debug')('sync-monorepo-packages:sync-package');
const {findPackageJsons} = require('./find-package');
const {createPkgChangeResult} = require('./model');

/**
 * These are the default fields which this program will sync from the
 * monorepo root `package.json` to its sub-packages.
 */
exports.DEFAULT_FIELDS = Object.freeze(
  /** @type {const} */ ([
    'keywords',
    'author',
    'repository',
    'license',
    'engines',
    'publishConfig',
  ])
);

/**
 * Reads a `package.json`
 * @returns {OperatorFunction<string,Readonly<PackageInfo>>}
 */
function readPackageJson() {
  return (pkgJsonPath$) =>
    pkgJsonPath$.pipe(
      mergeMap((pkgJsonPath) =>
        from(readPkg({cwd: path.dirname(pkgJsonPath), normalize: false})).pipe(
          map((pkg) =>
            Object.freeze({
              pkgPath: pkgJsonPath,
              pkg,
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
 * @param {(keyof PackageJson)[]} fields
 * @returns {OperatorFunction<PackageInfo,import('./model').PkgChangeResult>}
 */
function findChanges(sourcePkg$, fields) {
  return (pkgInfo$) =>
    pkgInfo$.pipe(
      mergeMap((pkgInfo) => {
        const {pkg, pkgPath} = pkgInfo;
        // only compare the interesting fields!
        const pkgFields = pick(pkg, ...fields);
        return sourcePkg$.pipe(
          map((sourcePkg) => {
            const srcPkgProps = pick(sourcePkg, ...fields);
            const patch = createPatch(pkgFields, srcPkgProps);
            if (patch.length) {
              return createPkgChangeResult(pkgPath, patch, pkg);
            }
          })
        );
      }),
      filterNullish()
    );
}

/**
 * Applies changes to a package.json
 * @todo this is "not idiomatic"; somebody fix this
 * @returns {MonoTypeOperatorFunction<import('./model').PkgChangeResult>}
 */
function applyChanges(dryRun = false) {
  return (observable) =>
    observable.pipe(
      map((pkgChange) => {
        const newPkg = {...pkgChange.pkg};
        // NOTE: applyPatch _mutates_ newPkg
        applyPatch(newPkg, pkgChange.patch);
        return pkgChange.withNewPackage(newPkg);
      }),
      mergeMap((pkgChange) =>
        iif(
          () => dryRun,
          of(pkgChange),
          defer(() =>
            from(
              writePkg(
                pkgChange.pkgPath,
                /**
                 * this is horrid, but there's a mismatch here
                 * @type {import('write-pkg/node_modules/type-fest').JsonObject}
                 */ (pkgChange.newPkg),
                {normalize: false}
              )
            )
          ).pipe(mapTo(pkgChange))
        )
      )
    );
}

/**
 * Inputs changes and outputs summaries of what happened
 * @returns {OperatorFunction<Readonly<import('./model').PkgChangeResult>,Summary>}
 */
exports.summarizePackageChanges = () => (pkgChange$) =>
  pkgChange$.pipe(
    filterNullish(),
    count(),
    map((count) => {
      if (count) {
        return {
          success: `Synced ${count} package.json ${pluralize('file', count)}`,
        };
      }
      return {noop: `No package.json changes needed; everything up-to-date!`};
    })
  );

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
  packages = [],
  dryRun = false,
  fields = [],
  lerna: lernaJsonPath = '',
} = {}) => {
  if (sourcePkgPath && path.basename(sourcePkgPath) !== 'package.json') {
    sourcePkgPath = path.join(sourcePkgPath, 'package.json');
  }

  const sourcePkg$ = iif(
    () => Boolean(sourcePkgPath),
    of(sourcePkgPath),
    defer(() =>
      from(findUp('package.json')).pipe(
        tap((pkgJsonPath) => {
          debug('found source package.json at %s', pkgJsonPath);
        }),
        filterNullish()
      )
    )
  ).pipe(
    mergeMap((sourcePkgPath) =>
      from(
        readPkg({
          cwd: normalizePkgPath(sourcePkgPath),
          normalize: false,
        })
      )
    ),
    share()
  );

  // get changes
  const changes$ = findPackageJsons({
    lernaJsonPath,
    packages,
    sourcePkgPath,
  }).pipe(readPackageJson(), findChanges(sourcePkg$, fields));

  // decide if we should apply them
  return changes$.pipe(applyChanges(dryRun));
};

/**
 * @template T
 * @typedef {import('rxjs').MonoTypeOperatorFunction<T>} MonoTypeOperatorFunction
 */

/**
 * @template T
 * @typedef {import('rxjs').Observable<T>} Observable
 */

/**
 * @typedef {import('type-fest').PackageJson} PackageJson
 */

/**
 * @template T,U
 * @typedef {import('rxjs').OperatorFunction<T,U>} OperatorFunction
 */

/**
 * @typedef SyncPackageJsonsOptions
 * @property {string} sourcePkgPath - Path to source package.json
 * @property {string[]} packages - Where to find packages; otherwise use Lerna
 * @property {boolean} dryRun - If `true`, print changes and exit
 * @property {(keyof PackageJson)[]} fields - Fields to copy
 * @property {string} lerna - Path to lerna.json
 */

/**
 * @typedef PackageInfo
 * @property {import('type-fest').PackageJson} pkg - Package json for package
 * @property {string} pkgPath - Path to package
 */

/**
 * @typedef {import('./sync-file').Summary} Summary
 */
