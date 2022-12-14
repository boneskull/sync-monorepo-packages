/// <reference path="../unexpected.d.ts" />

const expect = require('unexpected');
const execa = require('execa');
const os = require('os');
const fs = require('fs-extra');
const path = require('path');

const EXECUTABLE_PATH = require.resolve('../../src/cli.js');

/**
 *
 * @param {string[]} [args]
 * @param {execa.NodeOptions} [opts]
 * @returns {Promise<execa.ExecaChildProcess>}
 */
async function run(args = [], opts = {}) {
  return execa.node(EXECUTABLE_PATH, args, opts);
}

const FIXTURES = /** @type {const} */ ({
  'with Lerna': path.join(__dirname, 'fixture', 'lerna'),
  'with workspaces': path.join(__dirname, 'fixture', 'workspaces'),
  'with both Lerna and workspaces': path.join(
    __dirname,
    'fixture',
    'lerna-and-workspaces'
  ),
});

describe('sync-monorepo-packages', function () {
  /** @type {import('type-fest').PackageJson} */
  let pkgJson;

  before(async function () {
    pkgJson = await fs.readJson(
      path.join(__dirname, '..', '..', 'package.json')
    );
  });

  describe('--help', function () {
    it('should help', async function () {
      this.timeout(5000);
      this.slow(2500);

      return expect(run(['--help']), 'to be fulfilled with value satisfying', {
        stdout: new RegExp(/** @type {string} */ (pkgJson.description)),
      });
    });
  });

  for (const [title, fixturePath] of Object.entries(FIXTURES)) {
    describe(title, function () {
      /**
       * @type {string}
       */
      let tempDir;

      beforeEach(async function () {
        tempDir = path.join(
          await fs.mkdtemp(path.join(os.tmpdir(), 'sync-monorepo-packages-')),
          path.basename(fixturePath)
        );
        await fs.copy(fixturePath, tempDir, {
          recursive: true,
        });
      });

      afterEach(async function () {
        await fs.remove(tempDir);
      });

      describe('default behavior', function () {
        /** @type {import('execa').ExecaReturnValue<string>} */
        let result;

        beforeEach(async function () {
          result = await run([], {cwd: tempDir});
          await expect(result, 'to satisfy', {
            exitCode: 0,
          });
        });

        it('should report that package.json files were synced', function () {
          expect(result, 'to satisfy', {
            stdout: /synced 2 package.json files/i,
          });
        });

        it('should actually sync the package.json files', async function () {
          const [monorepoJson, barJson, fooJson] = await Promise.all([
            fs.readJson(path.join(tempDir, 'package.json')),
            fs.readJson(path.join(tempDir, 'packages', 'bar', 'package.json')),
            fs.readJson(path.join(tempDir, 'packages', 'foo', 'package.json')),
          ]);
          expect(barJson, 'to equal', fooJson);
          expect(barJson, 'to have property', 'keywords');
          expect(monorepoJson.keywords, 'to equal', barJson.keywords);
        });
      });

      describe('--no-package-json', function () {
        /** @type {import('execa').ExecaReturnValue<string>} */
        let result;

        beforeEach(async function () {
          result = await run(['--no-package-json', 'LICENSE'], {
            cwd: tempDir,
          });
          await expect(result, 'to satisfy', {exitCode: 0});
        });
        it('should not sync package.json files', async function () {
          const [barJson, fooJson] = await Promise.all([
            fs.readJson(path.join(tempDir, 'packages', 'bar', 'package.json')),
            fs.readJson(path.join(tempDir, 'packages', 'foo', 'package.json')),
          ]);
          expect({...fooJson, ...barJson}, 'to be empty');
        });
        it('should copy files', async function () {
          console.dir(result);
          await expect(
            Promise.all([
              fs.stat(path.join(tempDir, 'packages', 'foo', 'LICENSE')),
              fs.stat(path.join(tempDir, 'packages', 'bar', 'LICENSE')),
            ]),
            'to be fulfilled'
          );
        });
      });
    });
  }
});
