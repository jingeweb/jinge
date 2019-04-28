export {
  ForComponent
} from './components/for';
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
  Component
} from './core/component';
export {
  wrapViewModel as VM
} from './viewmodel/proxy';
export {
  vmWatch,
  vmUnwatch
} from './viewmodel/notify';
export {
  Messenger
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