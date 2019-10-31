import {
  assertFail
} from '../util';
import {
  wrapAttrs
} from '../vm';
import {
  RENDER_TO_DOM,
  isComponent
} from './component';

export function bootstrap(Component, dom, attrs) {
  if (dom === document.body) {
    throw new Error('bootstrap dom cannot be document.body');
  }
  /**
   * as we must pass ViewModel-Object as first argument to Component constructor,
   * we simple pass an empty attrs.
   */
  const bootAttrs = attrs || {};
  const bootComponent = new Component(wrapAttrs(bootAttrs));
  if (!isComponent(bootComponent)) assertFail();
  bootComponent[RENDER_TO_DOM](dom);
}
