import {
  Symbol
} from '../util';

export const CFG_VM_DEBUG = Symbol('vm_debug');
export const CFG_I18N_WARN_KEY_NOT_FOUND = Symbol('i18n_warn_key_not_found');

export const config = {
  [CFG_VM_DEBUG]: false,
  [CFG_I18N_WARN_KEY_NOT_FOUND]: true
};
