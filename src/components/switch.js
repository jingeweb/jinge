import {
  Component,
  RENDER,
  ARG_COMPONENTS,
  UPDATE_IF_NEED,
  UPDATE,
  ROOT_NODES,
  CONTEXT,
} from '../core/component';

import {
  renderSwitch,
  notifySwitch,
  updateSwitch
} from './if';

export class SwitchComponent extends Component {
  constructor(attrs) {
    super(attrs);
    this.test = attrs.test;
  }
  get test() {
    return this._t;
  }
  set test(v) {
    if (this._t === v) return;
    this._t = v;
    this[UPDATE_IF_NEED]();
  }
  [RENDER]() {
    return renderSwitch(this[ARG_COMPONENTS], this[ROOT_NODES], this.test, this[CONTEXT]);
  }
  [UPDATE]() {
    updateSwitch(this[ARG_COMPONENTS], this[ROOT_NODES], this.test, this[CONTEXT]);
    notifySwitch(this, this.test);
  }
}