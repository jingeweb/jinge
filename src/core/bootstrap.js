import {
  RENDER_TO_DOM,
  isComponent
} from './component';
import { assert_fail } from '../util';

export function bootstrap(Component, dom) {
  if (dom === document.body) {
    throw new Error('bootstrap dom cannot be document.body');
  }
  const bootComponent = new Component();
  if (!isComponent(bootComponent)) assert_fail();
  bootComponent[RENDER_TO_DOM](dom);
}
