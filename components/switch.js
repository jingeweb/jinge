import {
  Component,
  RENDER,
  UPDATE_IF_NEED,
  UPDATE
} from '../core/component';

import {
  renderSwitch,
  updateSwitch
} from './if';

export class SwitchComponent extends Component {
  constructor(attrs) {
    super(attrs);
    this.test = attrs.test;
    this.trans = attrs.transition;
  }
  get test() {
    return this._v;
  }
  set test(v) {
    if (this._v === v) return;
    this._v = v;
    this[UPDATE_IF_NEED]();
  }
  [RENDER]() {
    return renderSwitch(this);
  }
  [UPDATE]() {
    updateSwitch(this);
  }
}