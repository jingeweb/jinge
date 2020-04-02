import {
  Component, ComponentAttributes, __, isComponent
} from '../core/component';
import {
  i18n as i18nService
} from '../core/i18n';
import { createFragment } from '../util';
import { $$ } from '../vm/common';

export class I18nComponent extends Component {
  _key: string;
  _vms: unknown[];
  _sty: string;

  constructor(attrs: ComponentAttributes, renderKey: string, cstyId: string, renderVms: unknown[]) {
    super(attrs);
    this._key = renderKey;
    this._sty = cstyId;
    this._vms = renderVms;
    this.__i18nWatch(this._onchange);
  }

  __render(): Node[] {
    const renderFn = i18nService.__r(this._key, 'components');
    return renderFn(this, this._sty, ...this._vms);
  }

  _onchange(): void {
    this.__updateIfNeed();
  }

  __update(): void {
    if (this[$$].__related) {
      this[$$].__related.forEach((hooks, origin) => {
        hooks.forEach(hook => {
          origin.__unwatch(hook.prop, hook.handler);
        });
      });
      this[$$].__related.clear();
    }

    let $el = this.__lastDOM;
    const $parentEl = $el.parentNode;
    $el = $el.nextSibling;

    /*
     * 当前实现下，HANDLE_BEFORE_DESTROY 正好可以销毁子组件/子元素。
     * 但要注意，还需要手动清空旧的 rootNodes 和 nonRootCompNodes。
     */
    this.__handleBeforeDestroy(true);
    this[__].rootNodes.length = 0;
    this[__].nonRootCompNodes.length = 0;
    /*
     * 将新的元素替换到原来的旧的元素的位置。
     */
    const els = this.__render();
    if ($el) {
      $parentEl.insertBefore(els.length > 1 ? createFragment(els) : els[0], $el);
    } else {
      $parentEl.appendChild(els.length > 1 ? createFragment(els) : els[0]);
    }

    /**
     * 对切换后渲染的组件触发 AFTER_RENDER 生命周期。
     */
    this[__].rootNodes.forEach(n => {
      if (isComponent(n)) (n as Component).__handleAfterRender();
    });
    this[__].nonRootCompNodes.forEach(n => {
      (n as Component).__handleAfterRender();
    });
  }

  __beforeDestroy(): void {
    this._vms = null; // unlink vms, maybe not necessary
  }
}
