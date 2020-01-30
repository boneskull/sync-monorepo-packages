#!/usr/bin/env node
const {iif, concat} = require('rxjs');
const {info, warning, success, error} = require('log-symbols');
const wrapAnsi = require('wrap-ansi');
const {share, tap, map} = require('rxjs/operators');
const {
  syncPackageJsons,
  syncFile,
  SyncMonorepoPackagesError,
  summarizePackageChanges,
  summarizeFileCopies,
  DEFAULT_FIELDS
} = require('.');

const debug = require('debug')('sync-monorepo-packages:cli');
const {columns} = require('term-size')();

const yargs = require('yargs');

function obnoxiousDryRunWarning() {
  return `${warning}${warning}${warning} DRY RUN ${warning}${warning}${warning}`;
}

/**
 * Wraps a line to terminal size
 * @param {string} value Value to wrap
 */
function wrapLine(value) {
  return wrapAnsi(value, columns, {trim: false, wordWrap: true});
}

/**
 * Writes a string to the terminal nicely
 * @param {any} value
 */
function writeOut(value) {
  console.log(wrapLine(String(value)));
}

/**
 * Write an error to the terminal nicely
 * @param {Error|string} err - Error
 */
function writeError(err) {
  console.error(
    typeof err === 'string' || err instanceof SyncMonorepoPackagesError
      ? wrapLine(`${error} ${err}`)
      : err
  );
}

function main() {
  const argv = yargs
    .scriptName('sync-monorepo-packages')
    .usage(
      '$0 [file..]',
      // @ts-ignore
      'Synchronize files and metadata across packages in a monorepo',
      yargs => {
        yargs
          .positional('file', {
            description: 'One or more source files to sync',
            normalize: true,
            type: 'string',
            coerce: v => (Array.isArray(v) ? v : [v])
          })
          .example(
            '$0 --field keywords --field author -s ./foo/package.json',
            'Sync "keywords" and "author" from ./foo/package.json to packages found in lerna.json'
          )
          .example(
            '$0 --packages ./foo --dry-run --no-summary',
            'Using default fields, show what would have synced from package.json in current dir to packages in ./foo; hide summary'
          )
          .example(
            '$0 --no-package-json ./README.md',
            'Sync ./README.md to each package found in lerna.json. Do not sync anything in package.json'
          )
          .epilog(
            'Found a bug? Report it at https://github.com/boneskull/sync-monorepo-packages'
          );
      }
    )
    .options({
      'dry-run': {
        description:
          'Do not sync; print what would have changed (implies --verbose)',
        type: 'boolean',
        alias: 'D'
      },
      field: {
        default: DEFAULT_FIELDS,
        description: 'Fields in source package.json to sync',
        nargs: 1,
        type: 'array',
        alias: ['f', 'fields']
      },
      force: {
        description: `Overwrite destination file(s)`,
        type: 'boolean'
      },
      packages: {
        defaultDescription: '(use lerna.json)',
        description: 'Dirs/globs containing destination packages',
        nargs: 1,
        normalizePath: true,
        type: 'array',
        alias: ['p']
      },
      'package-json': {
        description: 'Sync package.json',
        type: 'boolean',
        default: true
      },
      source: {
        alias: 's',
        defaultDescription: '(closest package.json)',
        description: 'Path to source package.json',
        nargs: 1,
        normalizePath: true,
        type: 'string'
      },
      verbose: {
        description: 'Print change details',
        type: 'boolean',
        alias: 'v'
      },
      summary: {
        description: 'Print summary',
        type: 'boolean',
        default: true
      },
      lerna: {
        description: 'Path to lerna.json',
        defaultDescription: '(lerna.json in current dir)',
        nargs: 1,
        normalizePath: true,
        type: 'string',
        alias: 'l'
      }
    })
    .help()
    .version()
    .parse();

  debug('argv: %O', argv);

  // don't look at package.json if user passes --no-package-json
  const packageChange$ = iif(
    () => argv['package-json'],
    syncPackageJsons(argv).pipe(
      tap(result => {
        if (argv['dry-run'] || argv.verbose) {
          writeOut(result);
        }
      }),
      summarizePackageChanges()
    )
  );

  const copyInfo$ = iif(
    () => argv.file && argv.file.length,
    syncFile(argv.file, argv).pipe(
      tap(result => {
        if (argv['dry-run'] || argv.verbose) {
          writeOut(
            result.err ? `${error} ${result.err.message}` : `${info} ${result}`
          );
        }
      }),
      share(),
      summarizeFileCopies()
    )
  );

  if (argv['dry-run']) {
    writeOut(obnoxiousDryRunWarning());
  }

  concat(packageChange$, copyInfo$)
    .pipe(
      map(summary => {
        if (summary.success) {
          return `${success} ${summary.success}`;
        }
        if (summary.fail) {
          return `${error} ${summary.fail}`;
        }
        return `${info} ${summary.noop}`;
      })
    )
    .subscribe({
      next: result => {
        if (argv.summary) {
          writeOut(result);
        }
      },
      complete: () => {
        if (argv['dry-run']) {
          writeOut(obnoxiousDryRunWarning());
        }
      },
      error: err => {
        writeError(err);
        process.exitCode = 1;
      }
    });
}

if (require.main === module) {
  main();
}

/**
 * @template T,U
 * @typedef {import('rxjs').OperatorFunction<T,U>} OperatorFunction
 */

/**
 * @template T
 * @typedef {import('rxjs').Observable<T>} Observable
 */
