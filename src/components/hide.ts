import { Attributes, Component, __, isComponent } from '../core/component';

export interface HideComponentAttrs {
  test: boolean;
}
export class HideComponent extends Component {
  _test: boolean;

  constructor(attrs: Attributes<HideComponentAttrs>) {
    super(attrs);
    this.test = attrs.test;
  }

  get test() {
    return this._test;
  }

  set test(v: boolean) {
    if (this._test === v) return;
    this.__update();
  }

  async __doRender() {
    const els = await super.__doRender();
    this.__update();
    return els;
  }

  __update() {
    this[__].rootNodes.forEach((node) => {
      if (isComponent(node) || node.nodeType !== Node.ELEMENT_NODE) {
        return;
      }
      if (this.test) {
        (node as HTMLElement).classList.add('jg-hide');
      } else {
        (node as HTMLElement).classList.remove('jg-hide');
      }
    });
  }
}
