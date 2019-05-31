export {
  ForComponent
} from './components/for';
export {
  LogComponent
} from './components/log';
export {
  IfComponent,
  SwitchComponent
} from './components/if';
export {
  I18nComponent,
  _TComponent
} from './components/i18n';
export {
  ParameterComponent
} from './components/parameter';
export {
  ToggleClassComponent
} from './components/class';
export {
  HideComponent
} from './components/hide';
export {
  BindHtmlComponent
} from './components/html';
export {
  Component,
  AFTER_RENDER,
  BEFORE_DESTROY,
  UPDATE_IF_NEED,
  UPDATE,
  GET_REF,
  CONTEXT,
  GET_CONTEXT,
  SET_CONTEXT,
  RENDER,
  ARG_COMPONENTS
} from './core/component';
export {
  wrapViewModel as VM,
  wrapAttrs
} from './viewmodel/proxy';
export {
  vmWatch,
  vmUnwatch
} from './viewmodel/notify';
export {
  Messenger,
  NOTIFY,
  ON,
  OFF
} from './core/messenger';
export {
  _t,
  i18n,
  prefix as i18nPrefix,
  registerData as registerI18nData,
  messenger as i18nMessenger,
  I18N_DATA_CHANGED
} from './core/i18n';
export {
  bootstrap
} from './core/bootstrap';
export {
  Symbol,
  STR_DEFAULT,
  STR_JINGE,
  STR_EMPTY,
  isString,
  isObject,
  isFunction,
  isNumber,
  instanceOf,
  isUndefined,
  isBoolean,
  obj2class,
  setImmediate,
  clearImmediate
} from './util';

import * as components from './components';
import * as config from './config';
import * as dom from './dom';
import * as core from './core';
import * as util from './util';
import * as viewmodel from './viewmodel';

export {
  components,
  config,
  dom,
  core,
  util,
  viewmodel
};