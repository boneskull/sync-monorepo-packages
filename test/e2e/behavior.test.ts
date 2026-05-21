import {expect} from 'bupkis';
import {spawn} from 'node:child_process';
import {cp, mkdtemp, readFile, rm, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename, join} from 'node:path';
import {afterEach, before, beforeEach, describe, it} from 'node:test';
import {fileURLToPath} from 'node:url';

// Resolve tsx loader from the project's node_modules so the subprocess can
// find it regardless of its working directory.
const TSX_LOADER = import.meta.resolve('tsx/esm');

const EXECUTABLE_PATH = fileURLToPath(
  new URL('../../src/cli.ts', import.meta.url),
);

const FIXTURES = {
  'with workspaces': fileURLToPath(
    new URL('fixture/workspaces', import.meta.url),
  ),
} as const;

interface RunResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

const run = (
  args: string[] = [],
  opts: {cwd?: string} = {},
): Promise<RunResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--import', TSX_LOADER, EXECUTABLE_PATH, ...args],
      {cwd: opts.cwd, env: {...process.env}, stdio: ['ignore', 'pipe', 'pipe']},
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    child.on('close', (code) => {
      resolve({exitCode: code ?? 0, stderr, stdout});
    });
    child.on('error', reject);
  });

describe('sync-monorepo-packages', () => {
  let pkgJson: {description: string};

  before(async () => {
    pkgJson = JSON.parse(
      await readFile(
        fileURLToPath(new URL('../../package.json', import.meta.url)),
        'utf8',
      ),
    ) as {description: string};
  });

  describe('--help', () => {
    it('should output help text', async () => {
      const result = await run(['--help']);
      expect(result.stdout, 'to match', new RegExp(pkgJson.description));
    });
  });

  for (const [title, fixturePath] of Object.entries(FIXTURES)) {
    describe(title, () => {
      let tempDir: string;

      beforeEach(async () => {
        const tmpBase = await mkdtemp(
          join(tmpdir(), 'sync-monorepo-packages-'),
        );
        tempDir = join(tmpBase, basename(fixturePath));
        await cp(fixturePath, tempDir, {recursive: true});
      });

      afterEach(async () => {
        await rm(tempDir, {force: true, recursive: true});
      });

      describe('default behavior', () => {
        let result: RunResult;

        beforeEach(async () => {
          result = await run([], {cwd: tempDir});
          expect(result, 'to satisfy', {exitCode: 0});
        });

        it('should report that package.json files were synced', () => {
          expect(result.stdout, 'to match', /synced 2 package\.json files/i);
        });

        it('should actually sync the package.json files', async () => {
          const [monorepoJson, barJson, fooJson] = await Promise.all([
            readFile(join(tempDir, 'package.json'), 'utf8').then(
              (s) => JSON.parse(s) as Record<string, unknown>,
            ),
            readFile(
              join(tempDir, 'packages', 'bar', 'package.json'),
              'utf8',
            ).then((s) => JSON.parse(s) as Record<string, unknown>),
            readFile(
              join(tempDir, 'packages', 'foo', 'package.json'),
              'utf8',
            ).then((s) => JSON.parse(s) as Record<string, unknown>),
          ]);
          expect(barJson, 'to deep equal', fooJson);
          expect(barJson, 'to have property', 'keywords');
          expect(
            monorepoJson['keywords'],
            'to deep equal',
            barJson['keywords'],
          );
        });
      });

      describe('--no-package-json', () => {
        let result: RunResult;

        beforeEach(async () => {
          result = await run(['--no-package-json', 'LICENSE'], {
            cwd: tempDir,
          });
          expect(result, 'to satisfy', {exitCode: 0});
        });

        it('should not modify package.json files', async () => {
          const [barJson, fooJson] = await Promise.all([
            readFile(
              join(tempDir, 'packages', 'bar', 'package.json'),
              'utf8',
            ).then((s) => JSON.parse(s) as Record<string, unknown>),
            readFile(
              join(tempDir, 'packages', 'foo', 'package.json'),
              'utf8',
            ).then((s) => JSON.parse(s) as Record<string, unknown>),
          ]);
          // Sub-packages start with empty package.json; --no-package-json
          // means they should remain unchanged (empty).
          expect({...fooJson, ...barJson}, 'to be empty');
        });

        it('should copy files to each package', async () => {
          await Promise.all([
            stat(join(tempDir, 'packages', 'foo', 'LICENSE')),
            stat(join(tempDir, 'packages', 'bar', 'LICENSE')),
          ]);
        });
      });
    });
  }
});
