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
      describe('sync fields', function () {
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
          it('should report that package.json files were synced', async function () {
            return expect(
              run([], {cwd: tempDir}),
              'to be fulfilled with value satisfying',
              {stdout: /synced 2 package.json files/i}
            );
          });

          it('should actually sync the package.json files', async function () {
            await run([], {cwd: tempDir});
            const [monorepoJson, barJson, fooJson] = await Promise.all([
              fs.readJson(path.join(tempDir, 'package.json')),
              fs.readJson(
                path.join(tempDir, 'packages', 'bar', 'package.json')
              ),
              fs.readJson(
                path.join(tempDir, 'packages', 'foo', 'package.json')
              ),
            ]);
            expect(barJson, 'to equal', fooJson);
            expect(monorepoJson.keywords, 'to equal', barJson.keywords);
          });
        });
      });
    });
  }
});
