import {expect} from 'bupkis';
import {describe, it} from 'node:test';

import {pick} from '../../src/util.js';

describe('pick', () => {
  it('returns only the specified keys', () => {
    const obj = {a: 1, b: 2, c: 3};
    expect(pick(obj, 'a', 'c'), 'to deep equal', {a: 1, c: 3});
  });

  it('handles missing keys gracefully', () => {
    const obj = {a: 1} as {a: number; b?: number};
    const result = pick(obj, 'a', 'b');
    expect(result, 'to satisfy', {a: 1});
  });

  it('returns an empty object when no keys are provided', () => {
    const obj = {a: 1, b: 2};
    expect(pick(obj), 'to be empty');
  });
});
