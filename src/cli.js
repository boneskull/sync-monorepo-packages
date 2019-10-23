#!/usr/bin/env node

const {info, warning, success, error} = require('log-symbols');
const wrapAnsi = require('wrap-ansi');
const {columns} = require('term-size')();
const {share, map} = require('rxjs/operators');

const {
  syncPackageJsons,
  serializeChanges,
  summarizeChanges,
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
    .usage('$0 [options]')
    .example(
      '$0 --field keywords --field author -s ../package.json',
      'Sync "keywords" and "author" from ../package.json to packages found in lerna.json'
    )
    .example(
      '$0 --package ./foo --dry-run --no-summary',
      'Using default fields, show what would have synced from package.json in current dir to packages in ./foo; hide summary'
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
        description: 'Fields to sync from --source',
        nargs: 1,
        type: 'array',
        alias: ['f', 'fields']
      },
      package: {
        defaultDescription: '(use lerna.json)',
        description: 'Dirs/globs containing destination packages',
        nargs: 1,
        normalizePath: true,
        type: 'array',
        alias: ['p', 'packages']
      },
      source: {
        alias: 's',
        defaultDescription: '(package.json in current dir)',
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
    .epilog(
      'Found a bug? Report it at https://github.com/boneskull/sync-monorepo-packages'
    )
    .help()
    .version()
    .parse();

  const changes$ = syncPackageJsons(argv).pipe(share());

  if (argv['dry-run']) {
    obnoxiousDryRunWarning();
  }

  if (argv['dry-run'] || argv.verbose) {
    changes$
      .pipe(serializeChanges())
      .subscribe({next: writeOut, error: () => {}});
  }

  if (argv.summary) {
    changes$
      .pipe(
        summarizeChanges(),
        map(summary => `${info} ${summary}`)
      )
      .subscribe({next: writeOut, error: () => {}});
  }

  changes$.subscribe({
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
