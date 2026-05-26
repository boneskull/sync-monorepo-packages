# sync-monorepo-packages

> Synchronizes `package.json` fields and arbitrary files in a monorepo

## Features

- Auto-discovery of packages via `package.json` workspaces and/or `lerna.json`
- Optional manual control of destination packages
- Helpful defaults
- Detailed "dry run" mode
- Summary of operations
- Sync arbitrary files (e.g. `README.md`)

## Install

**Requires Node.js `>=22.5.1`**

```shell
npm install sync-monorepo-packages --save-dev
```

or

```shell
npx sync-monorepo-packages --help
```

## Usage

### CLI

```plain
sync-monorepo-packages v2.0.0
  Synchronize files and metadata across packages in a monorepo

USAGE
  $ sync-monorepo-packages [options]

OPTIONS
  -D, --dry-run          Do not sync; print what would have changed (implies --verbose)  [boolean]
  -f, --fields, --field  Fields in source package.json to sync  [string[]] default: ["keywords","author","repository","license","engines","publishConfig"]
      --force            Overwrite destination file(s)  [boolean]
  -l, --lerna            Path to lerna.json, if any  [string]
      --no-package-json  Sync package.json  [boolean] default: true
  -p, --packages         Dirs/globs containing destination packages  [string[]]
  -s, --source           Path to source package.json  [string]
      --no-summary       Print summary  [boolean] default: true
  -v, --verbose          Print change details  [boolean]
  -h, --help             Show help information  [boolean]
      --version          Show version number  [boolean]
```

### API

The library exports async generator functions that stream results as they happen:

```typescript
import {
  syncPackageJsons,
  summarizePackageChanges,
  syncFile,
  summarizeFileCopies,
} from 'sync-monorepo-packages';

// Sync package.json fields
const pkgResults = [];
for await (const change of syncPackageJsons({dryRun: true})) {
  console.log(change.toString());
  pkgResults.push(change);
}
const summary = summarizePackageChanges(pkgResults);
if (summary.success) console.log(summary.success);

// Sync arbitrary files
const fileResults = [];
for await (const result of syncFile(['LICENSE', 'README.md'])) {
  fileResults.push(result);
}
const fileSummary = summarizeFileCopies(fileResults);
if (fileSummary.success) console.log(fileSummary.success);
```

## Notes

- If there are other fields which would make sense to copy as a default, please suggest!
- Use at your own risk! `--dry-run` is your friend
- When copying files, directories may be created relative to the dirpath of `lerna.json` or `package.json`. For example, if you want to sync `foo/bar.md` to each package, `packages/*/foo/bar.md` will be the result.

## Breaking Changes in v2.0.0

- **ESM only.** No CommonJS build. Use `import` instead of `require`.
- **RxJS removed.** The public API is now async iterables (`AsyncGenerator<T>`) instead of RxJS `Observable<T>`. The `summarize*` functions now accept `T[]` arrays and return a single `Summary` object.
- **`yargs` replaced by `@boneskull/bargs`.** No user-visible differences; same flags supported.
- Node.js ≥ 22.5.1 required (was ≥ 18).

## License

Copyright © 2019 Christopher Hiller. Licensed Apache-2.0
