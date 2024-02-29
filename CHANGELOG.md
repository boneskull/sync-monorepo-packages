# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.0.3](https://github.com/boneskull/sync-monorepo-packages/compare/v1.0.2...v1.0.3) (2023-10-23)


### Bug Fixes

* **deps:** update dependency fs-extra to v11.1.1 ([3bb04f5](https://github.com/boneskull/sync-monorepo-packages/commit/3bb04f5a6d26a5a9fc4bcfb92d53f9ea8b04134f))
* **deps:** update dependency rxjs to v7.8.0 ([90f5d20](https://github.com/boneskull/sync-monorepo-packages/commit/90f5d2065ce56965956a291e3cc218d3a39db852))
* **deps:** update dependency rxjs to v7.8.1 ([fb4c1d2](https://github.com/boneskull/sync-monorepo-packages/commit/fb4c1d209bd5fa199d900d4e6644fc14f8d454c1))
* **deps:** update dependency yargs to v17.7.0 ([9f3d3e7](https://github.com/boneskull/sync-monorepo-packages/commit/9f3d3e71d5181c5a47041db991c92fbefdb48952))
* **deps:** update dependency yargs to v17.7.1 ([efc9772](https://github.com/boneskull/sync-monorepo-packages/commit/efc977241ce903dd47a01a33a51fce2c4ed35055))
* **deps:** update dependency yargs to v17.7.2 ([8698412](https://github.com/boneskull/sync-monorepo-packages/commit/86984123bdc539f9c3fca5ffbb7ec954cff36104))

## [1.0.2](https://github.com/boneskull/sync-monorepo-packages/compare/v1.0.1...v1.0.2) (2022-12-14)


### Bug Fixes

* **deps:** update dependency rxjs to v7.6.0 ([1d57275](https://github.com/boneskull/sync-monorepo-packages/commit/1d57275bcfb17619ebb51cfb064a99f00e545e77))
* **workspaces:** fix sync file behavior for workspaces ([cd0aab8](https://github.com/boneskull/sync-monorepo-packages/commit/cd0aab8cca2c2719cca2ada500239579286b0bec))

## [1.0.1](https://github.com/boneskull/sync-monorepo-packages/compare/v1.0.0...v1.0.1) (2022-11-30)


### Bug Fixes

* **deps:** update dependency fs-extra to v11.1.0 ([a2b6078](https://github.com/boneskull/sync-monorepo-packages/commit/a2b6078bdb46c32fc99d9f3c371c4f1a87fdf204))

## [1.0.0](https://github.com/boneskull/sync-monorepo-packages/compare/v0.3.5...v1.0.0) (2022-11-30)


### ⚠ BREAKING CHANGES

* This **changes the default behavior** of `sync-monorepo-packages` to first inspect the `workspaces` field of `package.json` to find target packages.
* npm v7 or newer required
* Supported Node.js versions are now `^14.17.0 || ^16.13.0 || >=18.0.0`

### Features

* add workspace support ([6df68b4](https://github.com/boneskull/sync-monorepo-packages/commit/6df68b44410bdc693c276486e84f888126bd42aa))


### Miscellaneous Chores

* drop Node.js v12 support ([5a0b59a](https://github.com/boneskull/sync-monorepo-packages/commit/5a0b59ac1bee92c8d538897d23c39ce3af8779bf))
* require npm v7 ([b28fd76](https://github.com/boneskull/sync-monorepo-packages/commit/b28fd766c1dca7f87c721e3273c1260a18173e91))

### [0.3.5](https://github.com/boneskull/sync-monorepo-packages/compare/v0.3.4...v0.3.5) (2022-04-18)

### Bug Fixes

- **util:** fix bad import ([da44c27](https://github.com/boneskull/sync-monorepo-packages/commit/da44c27bfadedcc9d66e47535435a6b91adc893e))
- update some deps per "npm audit" [security] ([3a8139f](https://github.com/boneskull/sync-monorepo-packages/commit/3a8139ff677667ced37a9d3b9366fb2a2560c1a0))

### [0.3.4](https://github.com/boneskull/sync-monorepo-packages/compare/v0.3.3...v0.3.4) (2021-06-15)

### Bug Fixes

- **build:** typescript crap ([f2682fe](https://github.com/boneskull/sync-monorepo-packages/commit/f2682fe497774576f14daebb6c055852fe93d3a1))

### [0.3.3](https://github.com/boneskull/sync-monorepo-packages/compare/v0.3.2...v0.3.3) (2021-06-15)

### Bug Fixes

- **pkg:** dep upgrades ([d73a236](https://github.com/boneskull/sync-monorepo-packages/commit/d73a23696331d328f5f10ab59022dc37febbeaeb))
- support for comma-separated fields ([e818bbf](https://github.com/boneskull/sync-monorepo-packages/commit/e818bbfca226b502a3d01148c4dcd8b89b751604))

### [0.3.2](https://github.com/boneskull/sync-monorepo-packages/compare/v0.3.1...v0.3.2) (2020-01-30)

### Bug Fixes

- fix file copying problems and observable issues ([7b3042d](https://github.com/boneskull/sync-monorepo-packages/commit/7b3042d54bb150cdb8954d5dfd2ed51cb49b4201))

### [0.3.1](https://github.com/boneskull/sync-monorepo-packages/compare/v0.3.0...v0.3.1) (2019-12-03)

### Bug Fixes

- vuln updates ([1913aa2](https://github.com/boneskull/sync-monorepo-packages/commit/1913aa2da41ba6b72448f73da85b0fd4c515ea35))

## [0.3.0](https://github.com/boneskull/sync-monorepo-packages/compare/v0.2.0...v0.3.0) (2019-11-02)

### Features

- **pkg:** provide typescript definitions ([889b6bf](https://github.com/boneskull/sync-monorepo-packages/commit/889b6bf82baa45dc3b71a89b04c3ef1148bb594a))

## [0.2.0](https://github.com/boneskull/sync-monorepo-packages/compare/v0.1.1...v0.2.0) (2019-10-30)

### Features

- improved efficiency, many fixes and output enhancements ([9b47fbe](https://github.com/boneskull/sync-monorepo-packages/commit/9b47fbe29e5d0223ff84f657300aa4bbafa737cd))

### [0.1.1](https://github.com/boneskull/sync-monorepo-packages/compare/v0.1.0...v0.1.1) (2019-10-29)

### Features

- add ability to sync files ([df4263c](https://github.com/boneskull/sync-monorepo-packages/commit/df4263cf697ac178eb38bfe352f51da3a5516379))

### Bug Fixes

- many bugs ([9208755](https://github.com/boneskull/sync-monorepo-packages/commit/920875509c4b316b51c9682d6eafa815c399037b))

## [0.1.0](https://github.com/boneskull/sync-monorepo-packages/compare/v0.0.3...v0.1.0) (2019-10-23)

### Features

- add publishConfig to defaults; fix application problems ([41b664f](https://github.com/boneskull/sync-monorepo-packages/commit/41b664f554a61b79f645e203772b9b1d765b601a))

### Bug Fixes

- turn off dry-run on everything ([3e7af3a](https://github.com/boneskull/sync-monorepo-packages/commit/3e7af3ac2bd4716c287108d8aaa44d292bacb84f))

### [0.0.3](https://github.com/boneskull/sync-monorepo-packages/compare/v0.0.2...v0.0.3) (2019-10-22)

### Bug Fixes

- attempt to fix changelog issues upon release ([bec9038](https://github.com/boneskull/sync-monorepo-packages/commit/bec903859b0a7291468813d0c76987018600e5e3))

### [0.0.2](https://github.com/boneskull/sync-monorepo-packages/compare/v0.0.1...v0.0.2) (2019-10-22)

### Bug Fixes

- remove cruft from package ([2c3da9f](https://github.com/boneskull/sync-monorepo-packages/commit/2c3da9f1085b338c3199e5cc5c98923cb293f2b2))

### 0.0.1 (2019-10-22)

### Features

- initial commit ([85dd44c](https://github.com/boneskull/sync-monorepo-packages/commit/85dd44ce3cbf7ac40f82400a89ad3b45295b9e7d))
