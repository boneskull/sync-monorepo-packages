# sync-monorepo-packages

> Synchronizes one or more fields between package.json files in a monorepo

## Features

- Auto-discovery of packages via `lerna.json`
- No Lerna? Manual control of package locations
- Helpful defaults
- Detailed "dry run" mode
- Summary of operations

## Install

```shell
$ npm install sync-monorepo-packages --save-dev
```

## Usage

```plain
sync-monorepo-packages [options]

Options:
  --dry-run, -D              Do not sync; print what would have changed[boolean]
  --field, -f, --fields      Fields to sync
       [array] [default: ["keywords","author","repository","license","engines"]]
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

- Use at your own risk! `--dry-run` is your friend

## License

Copyright © 2019 Christopher Hiller. Licensed Apache-2.0
