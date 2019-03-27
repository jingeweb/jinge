import {
  RENDER_TO_DOM,
  isComponent
} from './component';
import { assert_fail, config } from '../util';
import { wrapAttrs } from '../viewmodel/proxy';
import { VM_DEBUG_NAME } from '../viewmodel/common';

export function bootstrap(Component, dom) {
  if (dom === document.body) {
    throw new Error('bootstrap dom cannot be document.body');
  }
  /**
   * as we must pass ViewModel-Object as first argument to Component constructor,
   * we simple pass an empty attrs. 
   */
  const bootAttrs = config.vmDebug ? {
    [VM_DEBUG_NAME]: 'attrs_of_<root>'
  } : {};
  const bootComponent = new Component(wrapAttrs(bootAttrs));
  if (!isComponent(bootComponent)) assert_fail();
  bootComponent[RENDER_TO_DOM](dom);
}
