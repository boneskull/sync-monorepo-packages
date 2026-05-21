#!/usr/bin/env node
import {bargs, opt, pos} from '@boneskull/bargs';
import createDebug from 'debug';
import logSymbols from 'log-symbols';
import {readFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import wrapAnsi from 'wrap-ansi';
import {SyncMonorepoPackagesError} from './error.js';
import {summarizeFileCopies, syncFile} from './sync-file.js';
import {
  DEFAULT_FIELDS,
  summarizePackageChanges,
  syncPackageJsons,
} from './sync-package.js';
const debug = createDebug('sync-monorepo-packages:cli');
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  await readFile(join(__dirname, '..', 'package.json'), 'utf8'),
);
const columns = process.stdout.columns ?? 80;
const wrapLine = (value) =>
  wrapAnsi(value, columns, {trim: false, wordWrap: true});
const writeOut = (value) => {
  console.log(wrapLine(String(value)));
};
const writeError = (err) => {
  console.error();
  console.error(
    typeof err === 'string' || err instanceof SyncMonorepoPackagesError
      ? wrapLine(`${logSymbols.error} ${String(err)}`)
      : err,
  );
};
const DRY_RUN_WARNING = `${logSymbols.warning}${logSymbols.warning}${logSymbols.warning} DRY RUN ${logSymbols.warning}${logSymbols.warning}${logSymbols.warning}`;
const parser = pos.positionals(
  pos.variadic('string', {
    description: 'One or more source files to sync',
    name: 'file',
  }),
)(
  opt.options({
    'dry-run': opt.boolean({
      aliases: ['D'],
      description:
        'Do not sync; print what would have changed (implies --verbose)',
    }),
    field: opt.array('string', {
      aliases: ['f', 'fields'],
      default: [...DEFAULT_FIELDS],
      description: 'Fields in source package.json to sync',
    }),
    force: opt.boolean({
      description: 'Overwrite destination file(s)',
    }),
    lerna: opt.string({
      aliases: ['l'],
      description: 'Path to lerna.json, if any',
    }),
    'package-json': opt.boolean({
      default: true,
      description: 'Sync package.json',
    }),
    packages: opt.array('string', {
      aliases: ['p'],
      description: 'Dirs/globs containing destination packages',
    }),
    source: opt.string({
      aliases: ['s'],
      description: 'Path to source package.json',
    }),
    summary: opt.boolean({
      default: true,
      description: 'Print summary',
    }),
    verbose: opt.boolean({
      aliases: ['v'],
      description: 'Print change details',
    }),
  }),
);
const {positionals, values} = await bargs('sync-monorepo-packages', {
  description: pkg.description,
  epilog:
    'Found a bug? Report it at https://github.com/boneskull/sync-monorepo-packages',
  version: pkg.version,
})
  .globals(parser)
  .parseAsync();
const [fileArgs] = positionals;
const dryRun = values['dry-run'] ?? false;
const verbose = values.verbose ?? false;
const showSummary = values.summary ?? true;
debug('argv values: %O', values);
debug('positionals: %O', positionals);
if (dryRun) {
  writeOut(DRY_RUN_WARNING);
}
try {
  // Sync package.json fields
  if (values['package-json']) {
    const pkgResults = [];
    for await (const result of syncPackageJsons({
      dryRun,
      fields: values.field,
      lerna: values.lerna,
      packages: values.packages,
      source: values.source,
    })) {
      pkgResults.push(result);
      if (dryRun || verbose) {
        writeOut(result);
      }
    }
    if (showSummary) {
      const summary = summarizePackageChanges(pkgResults);
      if (summary.success) {
        writeOut(`${logSymbols.success} ${summary.success}`);
      }
      if (summary.fail) {
        writeOut(`${logSymbols.error} ${summary.fail}`);
      }
      if (summary.noop) {
        writeOut(`${logSymbols.info} ${summary.noop}`);
      }
    }
  }
  // Sync files
  if (fileArgs?.length) {
    const fileResults = [];
    for await (const result of syncFile(fileArgs, {
      dryRun,
      force: values.force ?? false,
      lerna: values.lerna,
      packages: values.packages,
    })) {
      fileResults.push(result);
      if (dryRun || verbose) {
        writeOut(
          result.err
            ? `${logSymbols.error} ${result.err.message}`
            : `${logSymbols.info} ${result}`,
        );
      }
    }
    if (showSummary) {
      const summary = summarizeFileCopies(fileResults);
      if (summary.success) {
        writeOut(`${logSymbols.success} ${summary.success}`);
      }
      if (summary.fail) {
        writeOut(`${logSymbols.error} ${summary.fail}`);
      }
      if (summary.noop) {
        writeOut(`${logSymbols.info} ${summary.noop}`);
      }
    }
  }
} catch (err) {
  writeError(err);
  process.exitCode = 1;
}
if (dryRun) {
  writeOut(DRY_RUN_WARNING);
}
//# sourceMappingURL=cli.js.map
