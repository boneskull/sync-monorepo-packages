const expect = require('unexpected');
const unexpectedSinon = require('unexpected-sinon');
const sinon = require('sinon');

global.sinon = sinon;

global.expect = expect.clone().use(unexpectedSinon);
