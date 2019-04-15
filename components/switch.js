import {
  Component,
  RENDER,
  UPDATE_IF_NEED,
  UPDATE,
  ARG_COMPONENTS
} from '../core/component';

import {
  renderSwitch,
  updateSwitch,
  updateSwitch_ts_end
} from './if';
import {
  STR_DEFAULT
} from '../util';

export class SwitchComponent extends Component {
  constructor(attrs) {
    super(attrs);
    this.test = attrs.test;
    this.ts = attrs.transition; // enable transition
    this._t = null;
    this._p = null;
    this._h = null;
  }
  get test() {
    return this._v;
  }
  set test(v) {
    const acs = this[ARG_COMPONENTS];
    if (!acs || !(v in acs)) {
      v = STR_DEFAULT;
    }
    if (this._v === v) return;
    this._v = v;
    this[UPDATE_IF_NEED]();
  }
  _oe() {
    updateSwitch_ts_end(this);
  }
  [RENDER]() {
    return renderSwitch(this);
  }
  [UPDATE]() {
    updateSwitch(this);
  }
}