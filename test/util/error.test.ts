import { throwErr } from '../../src/util/error';
import { jestApi } from '../_helper';

afterEach(() => jestApi.restoreAllMocks());

test('development errors include readable diagnostics and substituted arguments', () => {
  jestApi.replaceProperty(process.env, 'NODE_ENV', 'development');
  expect(() => throwErr('ctx-key-exist', 'theme')).toThrow('Contenxt with key: theme is exist.');
  expect(() => throwErr('hook-miss-component')).toThrow('global component not found');
});
test('production errors contain the stable error ID and documentation URL', () => {
  jestApi.replaceProperty(process.env, 'NODE_ENV', 'production');
  expect(() => throwErr('fc-render-empty')).toThrow('Production min error: fc-render-empty');
  expect(() => throwErr('fc-render-empty')).toThrow('/error/fc-render-empty');
});
