import {
  RENDER_TO_DOM,
  isComponent
} from './component';
import { assert_fail } from '../util';
import { wrapViewModel } from '../viewmodel/proxy';

export function bootstrap(Component, dom) {
  if (dom === document.body) {
    throw new Error('bootstrap dom cannot be document.body');
  }
  /**
   * as we must pass ViewModel-Object as first argument to Component constructor,
   *   we simple pass an empty attrs. 
   */
  const bootComponent = new Component(wrapViewModel({}, true));
  if (!isComponent(bootComponent)) assert_fail();
  bootComponent[RENDER_TO_DOM](dom);
}
