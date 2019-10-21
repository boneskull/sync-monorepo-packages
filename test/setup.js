import expect from 'unexpected';
import sinon from 'sinon';
import unexpectedSinon from 'unexpected-sinon';

global.sinon = sinon;

global.expect = expect.clone().use(unexpectedSinon);
