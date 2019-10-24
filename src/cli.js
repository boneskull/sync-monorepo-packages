#!/usr/bin/env node
const {EMPTY, iif, concat} = require('rxjs');
const debug = require('debug')('sync-monorepo-packages:cli');
const {info, warning, success, error} = require('log-symbols');
const wrapAnsi = require('wrap-ansi');
const {columns} = require('term-size')();
const {share, map} = require('rxjs/operators');

const {
  syncPackageJsons,
  syncFile,
  serializeCopyInfo,
  serializePackageChange,
  summarizePackageChanges,
  SyncMonorepoPackagesError,
  DEFAULT_FIELDS
} = require('./index.js');
const yargs = require('yargs');

function obnoxiousDryRunWarning() {
  writeOut(
    `${warning}${warning}${warning} DRY RUN ${warning}${warning}${warning}`
  );
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
 * @param {string} value
 */
function writeOut(value) {
  console.log(wrapLine(value));
}

/**
 * Write an error to the terminal nicely
 * @param {Error} err - Error
 * @param {boolean} verbose - If true, just print the whole thing
 */
function writeError(err, verbose = false) {
  console.error(
    err instanceof SyncMonorepoPackagesError
      ? verbose
        ? err
        : wrapLine(`${error} ${err.message}`)
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

  const changes$ = iif(
    () => argv['package-json'],
    syncPackageJsons(argv).pipe(share()),
    EMPTY
  );

  if (argv['dry-run']) {
    obnoxiousDryRunWarning();
  }

  if (argv['dry-run'] || argv.verbose) {
    changes$
      .pipe(serializePackageChange())
      .subscribe({next: writeOut, error: () => {}});
  }

  if (argv.summary) {
    changes$
      .pipe(
        summarizePackageChanges(),
        map(summary => `${info} ${summary}`)
      )
      .subscribe({next: writeOut, error: () => {}});
  }

  /**
   * @type {import('rxjs').Observable<import('./index.js').CopyInfo>}
   */
  const files$ = iif(
    () => argv.file.length,
    syncFile(argv.file, argv).pipe(share()),
    EMPTY
  );
  if (argv['dry-run'] || argv.verbose) {
    files$
      .pipe(serializeCopyInfo())
      .subscribe({next: writeOut, error: () => {}});
  }

  concat(changes$, files$).subscribe({
    complete() {
      writeOut(`${success} Done!`);
      if (argv['dry-run']) {
        obnoxiousDryRunWarning();
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
