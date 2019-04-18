import {
  RENDER_TO_DOM,
  isComponent
} from './component';
import {
  assert_fail,
  createEmptyObject
} from '../util';
import {
  config,
  CFG_VM_DEBUG
} from '../config';
import {
  wrapAttrs
} from '../viewmodel/proxy';
import {
  VM_DEBUG_NAME
} from '../viewmodel/common';

export function bootstrap(Component, dom, attrs) {
  if (dom === document.body) {
    throw new Error('bootstrap dom cannot be document.body');
  }
  /**
   * as we must pass ViewModel-Object as first argument to Component constructor,
   * we simple pass an empty attrs. 
   */
  const bootAttrs = createEmptyObject();
  attrs && Object.assign(bootAttrs, attrs);

  if (config[CFG_VM_DEBUG]) {
    bootAttrs[VM_DEBUG_NAME] = 'attrs_of_<root>';
  }
  const bootComponent = new Component(wrapAttrs(bootAttrs));
  if (!isComponent(bootComponent)) assert_fail();
  bootComponent[RENDER_TO_DOM](dom);
}
