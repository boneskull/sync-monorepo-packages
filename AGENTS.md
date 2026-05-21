# AGENTS.md

This file provides guidance to AI agents (Claude Code, Cursor, Copilot, etc.) when working with code in this repository.

## What This Is

**boneskull-template** is a comprehensive GitHub template for creating modern Node.js TypeScript libraries. It's a fully-configured development environment with quality enforcement, automation, and best practices pre-configured.

**Purpose**: Bootstrap new Node.js packages with all tooling, testing, linting, CI/CD, and publishing workflows ready to use.

**Key Features**:

- ESLint v9+ flat config with TypeScript support
- Native Node.js test runner (`node:test`) with `bupkis` assertions
- Dual-module builds (ESM + CommonJS) via `zshy`
- Strict TypeScript with pragmatic exceptions
- Automated releases (release-please) and dependency updates (Renovate)
- Git hooks via Husky for quality gates
- Zero production dependencies

## Quick Start

```bash
# Use as GitHub template, then:
npm install              # Install dependencies (runs husky + build)
npm test                 # Run tests with node:test
npm run test:watch       # TDD watch mode
npm run build            # Build ESM + CJS via zshy
npm run lint             # Check all linters (parallel)
npm run fix              # Auto-fix all issues (sequential)
```

## Essential Commands

```bash
# Development
npm run lint:eslint      # ESLint (code quality)
npm run lint:types       # TypeScript type checking
npm run lint:prettier    # Format checking
npm run lint:spelling    # Spell check (cspell)
npm run lint:knip        # Find unused dependencies
npm run lint:markdown    # Markdown linting

# Git workflow
npm run commitlint       # Validate commit message
npm run lint:staged      # Run on staged files (pre-commit hook)
```

## Project Structure

```text
boneskull-template/
├── src/index.ts         # Main entry point (currently empty - blank slate)
├── test/                # Tests (*.test.ts pattern)
├── dist/                # Build output: index.js (ESM), index.cjs (CJS), *.d.ts/*.d.cts
├── .github/
│   ├── workflows/       # CI: lint, test (Node 20/22/24), release-please
│   └── actions/         # Reusable: prepare (setup), publish (npm)
├── .husky/              # Git hooks: pre-commit (lint-staged), commit-msg (commitlint)
├── eslint.config.js     # ESLint v9+ flat config
├── tsconfig.json        # TypeScript strict mode config
└── package.json         # Scripts, deps, embedded configs (prettier, lint-staged, zshy, knip)
```

## Key Patterns

### Testing (node:test + bupkis)

```typescript
import {describe, it} from 'node:test';
import {expect} from 'bupkis';

describe('feature name', () => {
  it('should do something', () => {
    expect(value, 'to equal', expected);
    expect(obj, 'to have property', 'key');
    expect(result, 'to satisfy', {key: value});
  });
});
```

**Test files**: `test/**/*.test.ts` pattern
**Run with**: `npm test` or `npm run test:watch`

### Conventional Commits (Required)

```bash
feat: add new feature        # Minor version bump
fix: resolve bug             # Patch version bump
chore: update dependencies   # No version bump
docs: update README          # No version bump

# For breaking changes:
feat!: major API change

BREAKING CHANGE: Description in footer
```

**Note**: Formatting rules are relaxed (no max line lengths, flexible subject casing). Focus on semantic type.

### Adding Source Code

1. Create TypeScript file in `src/`
2. Export from `src/index.ts`
3. Build: `npm run build`
4. Test: `npm test`

Output appears in `dist/`:

- `index.js` (ESM)
- `index.cjs` (CommonJS)
- `index.d.ts` + `index.d.cts` (type declarations)

### Code Style (Enforced)

- ✅ Semicolons required
- ✅ Single quotes
- ✅ 2-space indentation
- ✅ Arrow functions for callbacks
- ✅ Function expressions over declarations
- ✅ Inline type imports: `import { type Foo } from 'bar'`
- ✅ Unused variables start with `_`

**TypeScript Pragmatism**:

- `any` allowed (sometimes necessary)
- Non-null assertions (`!`) allowed
- Test files have relaxed rules (no unsafe assignment warnings)

## Important Context

### Why These Tools?

**zshy instead of Vite/esbuild**: Purpose-built for dual-module (ESM + CJS) npm packages with TypeScript. Generates both `.js`/`.cjs` and `.d.ts`/`.d.cts` from single source.

**node:test instead of Jest/Mocha**: Zero external test framework dependency. Built into Node.js 20+. Fast, simple, actively maintained by Node.js core team.

**Blue Oak License**: Modern permissive license (similar to MIT/Apache 2.0) with clearer language and explicit patent grant.

**Exact version pinning** (`.npmrc` has `save-exact=true`): Reproducible builds. Renovate Bot handles updates via automated PRs with CI testing.

**Relaxed commitlint rules**: Focus on semantic commit type (feat/fix/chore) rather than pedantic formatting. Makes commits easier to write while maintaining automation benefits.

### Git Hooks Strategy

**Pre-commit** (`.husky/pre-commit`): Runs `lint-staged` on only changed files (fast feedback)
**Commit-msg** (`.husky/commit-msg`): Validates conventional commit format

**lint-staged** runs per file type:

- `.ts/.js/.yml/.json5`: eslint → prettier → cspell
- `.json` (except package-lock): eslint → prettier → cspell
- `.md`: markdownlint → prettier → cspell

### Release Workflow

1. Develop on feature branch
2. Open PR (CI runs lint + test)
3. Merge to `main`
4. Release-please bot creates/updates "Release PR"
5. Merge Release PR → Creates GitHub release + git tag
6. **(Optional)** Publishes to npm (currently disabled in `.github/workflows/release.yml`)

To enable npm publishing: Add `NPM_TOKEN` to GitHub secrets and uncomment publish step in `release.yml`.

### TypeScript Configuration

**Strict mode enabled** with extra checks:

- `noUncheckedIndexedAccess: true` - Prevents `array[i]` bugs
- `noUncheckedSideEffectImports: true` - Import safety
- `module: "nodenext"` - Hybrid ESM/CJS support
- `verbatimModuleSyntax: false` - Allows type erasure

**Test files** (`test/**/*.test.ts`) have relaxed rules:

- `no-floating-promises: off`
- `no-unsafe-assignment: off`
- `no-unsafe-member-access: off`

### ESLint v9+ Flat Config

**Key points**:

- Uses new flat config format (not `.eslintrc`)
- Type-aware linting (uses `tsconfig.json`)
- Multiple plugins: typescript-eslint, stylistic, perfectionist, jsonc
- Different rules for test files vs source files
- Ignores: `docs/`, `dist/`, `coverage/`, `node_modules/`, `worktrees/`

### Common Pitfalls

1. **Commit rejected**: Use conventional commit format: `type: message`
2. **Tests not found**: File must match `test/**/*.test.ts` pattern (not `.spec.ts`)
3. **Module resolution errors**: TypeScript uses `module: "nodenext"` - may need `.js` extensions in imports
4. **Build before publishing**: Run `npm run build` before `npm pack` - dist output is gitignored but included in npm package
5. **ESLint type errors**: Ensure `tsconfig.json` includes the file; run `npm run lint:types` first

### Maintenance

**Automated** (via Renovate):

- Dependency updates (auto-merge minor/patch)
- Lock file maintenance
- Security vulnerability fixes

**Manual review required**:

- Major version updates
- Breaking changes

**Health checks**:

```bash
npm run lint:knip        # Find unused dependencies
npm audit                # Security vulnerabilities
npm outdated             # Check for updates
```

## Quick Reference

| Task        | Command                 |
| ----------- | ----------------------- |
| Install     | `npm install`           |
| Test        | `npm test`              |
| TDD         | `npm run test:watch`    |
| Build       | `npm run build`         |
| Lint        | `npm run lint`          |
| Fix         | `npm run fix`           |
| Type check  | `npm run lint:types`    |
| Spell check | `npm run lint:spelling` |

| Issue           | Solution                            |
| --------------- | ----------------------------------- |
| Commit rejected | Use `type: message` format          |
| ESLint errors   | Run `npm run fix:eslint`            |
| Type errors     | Check `tsconfig.json` includes file |
| Test not found  | Must be `*.test.ts` in `test/`      |

## Resources

- **Node.js test runner**: https://nodejs.org/docs/latest/api/test.html
- **bupkis assertions**: https://github.com/boneskull/bupkis
- **ESLint flat config**: https://eslint.org/docs/latest/use/configure/configuration-files
- **Conventional Commits**: https://www.conventionalcommits.org/
- **Template author**: Christopher Hiller (boneskull@boneskull.com)
