const execa = require('execa');

describe('smoke test', function () {
  it('should work', function () {
    this.timeout(5000);
    this.slow(2500);

    expect(
      () => execa.sync('node', [require.resolve('../src/cli.js'), '--help']),
      'not to throw'
    );
  });
});
