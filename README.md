# sync-monorepo-packages

> Synchronizes one or more fields between package.json files in a monorepo

## Features

- Auto-discovery of packages via `lerna.json`
- No Lerna? Manual control of package locations
- Helpful defaults
- Detailed "dry run" mode
- Summary of operations

## Install

**Requires Node.js v10.0.0 or newer!**

```shell
$ npm install sync-monorepo-packages --save-dev
```

_or_

```shell
$ npx sync-monorepo-packages --help
```

## Usage

Here, I have pasted the output of `--help` because I am lazy:

```plain
sync-monorepo-packages [options]

Options:
  --dry-run, -D              Do not sync; print what would have changed (implies
                             --verbose)                                [boolean]
  --field, -f, --fields      Fields to sync from --source      [array] [default:
         ["keywords","author","repository","license","engines","publishConfig"]]
  --package, -p, --packages  Dirs/globs containing destination packages
                                             [array] [default: (use lerna.json)]
  --source, -s               Path to source package.json
                               [string] [default: (package.json in current dir)]
  --verbose, -v              Print change details                      [boolean]
  --summary                  Print summary             [boolean] [default: true]
  --lerna, -l                Path to lerna.json
                                 [string] [default: (lerna.json in current dir)]
  --help                     Show help                                 [boolean]
  --version                  Show version number                       [boolean]

Examples:
  sync-monorepo-packages --field keywords   Sync "keywords" and "author" from
  --field author -s ../package.json         ../package.json to packages found in
                                            lerna.json
  sync-monorepo-packages --package ./foo    Using default fields, show what
  --dry-run --no-summary                    would have synced from package.json
                                            in current dir to packages in ./foo;
                                            hide summary

Found a bug? Report it at https://github.com/boneskull/sync-monorepo-packages
```

## Notes

- If there are other fields which would make sense to copy as a default, please suggest!
- Use at your own risk! `--dry-run` is your friend
- There is an API that you can use.

## License

Copyright © 2019 Christopher Hiller. Licensed Apache-2.0
