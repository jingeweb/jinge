import {
  createComment,
  createElement,
  createTextNode,
  STR_EMPTY
} from '../util';
import {
  ROOT_NODES,
  I18N_WATCH
} from './component';
import {
  i18n as i18nService,
  I18N_GET_TEXT
} from './i18n';

export function emptyRenderFn(component) {
  const el = createComment(STR_EMPTY);
  component[ROOT_NODES].push(el);
  return [el];
}

export function errorRenderFn(component) {
  const el = createElement('span', {
    style: 'color: red !important;'
  });
  el.textContent = 'template parsing failed! please check webpack log.';
  component[ROOT_NODES].push(el);
  return [el];
}

export function textRenderFn(component, txtContent) {
  const el = createTextNode(txtContent);
  component[ROOT_NODES].push(el);
  return el;
}

export function i18nRenderFn(component, key, isRoot) {
  const el = createTextNode();
  const fn = () => {
    el.textContent = i18nService[I18N_GET_TEXT](key);
  };
  fn();
  component[I18N_WATCH](fn);
  isRoot && component[ROOT_NODES].push(el);
  return el;
}
