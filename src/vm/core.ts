import { arrayRemove, isArray, arrayEqual, isObject } from '../util';
import {
  ViewModelNode,
  ViewModelParent,
  PropertyPathItem,
  parsePropertyPath,
  ViewModelWatchHandler,
  ViewModelCore,
  ViewModelObject,
  RelatedListenersMap,
  $$,
  removeParent,
} from './common';
import { loopCreateNode, loopGetNode, loopClearNode, deleteNode } from './node';
import { handleCancel, loopNotify } from './notify';

export class ViewModelCoreImpl implements ViewModelNode, ViewModelCore {
  __parents: ViewModelParent[];
  __listeners: Map<string, ViewModelNode>;
  __notifiable: boolean;
  __related: RelatedListenersMap;
  __setters: Map<string | symbol, (v: unknown) => void>;

  target: unknown;
  proxy: unknown;

  /**
   * Don't use the constructor. Use createViewModel instead.
   */
  constructor(target: unknown) {
    this.__notifiable = true;
    this.__parents = null;
    this.__listeners = null;
    this.__related = null;
    this.__setters = null;

    this.target = target;
    this.proxy = null;

    Object.defineProperty(target, $$, {
      value: this,
      writable: false,
      configurable: true,
      enumerable: false,
    });
  }

  __watch(
    propertyPath: string | PropertyPathItem | PropertyPathItem[],
    handler: ViewModelWatchHandler,
    related?: ViewModelCore,
  ): void {
    propertyPath = parsePropertyPath(propertyPath);
    const dbStarIdx = propertyPath.indexOf('**');
    if (dbStarIdx >= 0 && dbStarIdx !== propertyPath.length - 1) {
      /**
       * 'a.b.**' is good.
       * 'a.b.**.c' is bad.
       */
      throw new Error('wizard "**" must be last element in path.');
    }
    const node = loopCreateNode(this, propertyPath);
    if (!node.__handlers) {
      node.__handlers = [];
    }
    if (node.__handlers.indexOf(handler) < 0) {
      node.__handlers.push(handler);
    }

    if (related && related !== this) {
      /**
       * If some child of this component is passed as argument(ie.
       * use slot-pass: attribute) like ng-tranclude in angular 1.x,
       * the child may contain some messenger listeners not belong to
       * this component but belong to outer parent.
       *
       * When destroy this component, we should also remove messenger listeners
       *   belong to outer parent to prevent memory leak.
       * To implement this goal, we maitain VM_RELATED_LISTENERS.
       * When render view-tree, any messenger listeners belong to outer
       * parent, will be also linked under VM_RELATED_LISTENERS, then
       * when we destroy this component, the listeners can also be clear.
       *
       * For examle:
       *
       * <!-- outer parent: RootApp -->
       * <div>
       * <if expect="show">
       * <Tooltip>
       * <argument arg:pass="default">
       * <p>hello, world. my name is ${name}</p>
       * </argument>
       * </Tooltip>
       * </if>
       * </div>
       *
       * when the `show` variable changed from true to false, the
       * Tooltip component will be destroy. The messenger listener belong
       * to the outer parent RootApp which watch `name` variable should
       * also be removed.
       */
      related.__addRelated(this, propertyPath, handler);
    }
  }

  __unwatch(
    propertyPath?: string | PropertyPathItem | PropertyPathItem[],
    handler?: ViewModelWatchHandler,
    related?: ViewModelCore,
  ): void {
    if (!propertyPath) {
      loopClearNode(this);
      return;
    }

    const node = loopGetNode(this, parsePropertyPath(propertyPath));
    if (!node) {
      return;
    }

    const handlers = node.__handlers;
    if (!handlers) {
      return;
    }

    if (!handler) {
      // remove all if second parameter is not provided
      handlers.forEach(handleCancel);
      handlers.length = 0;
    } else {
      handleCancel(handler);
      arrayRemove(handlers, handler);
    }

    deleteNode(node);

    if (related && related !== this) {
      related.__rmRelated(this, propertyPath, handler);
    }
  }

  __notify(propertyPath: string | PropertyPathItem[], immediate = false): void {
    if (!this.__notifiable) {
      return;
    }
    propertyPath = parsePropertyPath(propertyPath);
    if (this.__listeners) {
      loopNotify(this, propertyPath, immediate);
    }
    const parents = this.__parents;
    parents?.forEach((ps) => {
      const vm = ps.core;
      if (!vm) {
        // eslint-disable-next-line no-console
        console.error('dev-warn-unexpected: parent of ViewModelCore has been destroied but not unlink.');
        return;
      }
      vm.__notify([ps.prop].concat(propertyPath), immediate);
    });
  }

  __destroy(): void {
    this.__notifiable = false;
    this.__parents = null;
    // clear listeners
    loopClearNode(this);
    // unlink wrapper proxy
    this.proxy = null;

    if (this.__related) {
      this.__related.forEach((hooks, origin) => {
        hooks.forEach((hook) => {
          origin.__unwatch(hook.prop, hook.handler);
        });
      });
      this.__related = null;
    }

    const target = this.target as ViewModelObject;
    /*
     * 解除 ViewModel 之间的 VM_PARENTS 关联。
     * 使用 getOwnPropertyNames 可以获取所有属性，但无法获取 setter 函数定义的属性。
     */
    const sfm = this.__setters;
    if (sfm) {
      sfm.forEach((fn, prop) => {
        if (fn === null) {
          return;
        }
        const v = target[prop as string];
        if (!isObject(v) || !($$ in (v as Record<symbol, unknown>))) {
          return;
        }
        removeParent((v as ViewModelObject)[$$], this, prop as string);
      });
      this.__setters = null;
    }
    Object.getOwnPropertyNames(target).forEach((prop) => {
      const v = target[prop];
      if (!isObject(v) || !($$ in (v as Record<symbol, unknown>))) {
        return;
      }
      removeParent((v as ViewModelObject)[$$], this, prop);
    });

    // unlink vm target
    delete target[$$];
    this.target = null;
  }

  __addRelated(
    origin: ViewModelCoreImpl,
    propertyPath: PropertyPathItem | PropertyPathItem[],
    handler: ViewModelWatchHandler,
  ): void {
    if (!this.__related) this.__related = new Map();
    let hook = this.__related.get(origin);
    if (!hook) {
      this.__related.set(origin, (hook = []));
    }
    hook.push({
      prop: propertyPath,
      handler,
    });
  }

  __rmRelated(
    origin: ViewModelCoreImpl,
    propertyPath: PropertyPathItem | PropertyPathItem[],
    handler: ViewModelWatchHandler,
  ): void {
    if (!this.__related) return;
    const hook = this.__related.get(origin);
    if (!hook) return;
    const isPropArray = isArray(propertyPath);
    const i = hook.findIndex((it) => {
      return (
        handler === it.handler &&
        (isPropArray
          ? arrayEqual(propertyPath as PropertyPathItem[], it.prop as PropertyPathItem[])
          : (propertyPath as PropertyPathItem) === (it.prop as PropertyPathItem))
      );
    });
    if (i >= 0) {
      hook.splice(i, 1);
    }
  }
}
