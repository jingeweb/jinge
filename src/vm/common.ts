import {
  isString,
  isUndefined,
  isObject,
  isArray,
  // isObject,
  // instanceOf
} from '../util';

export const $$ = Symbol('$$');
export type ViewModelWatchHandler = (propertyPath: PropertyPathItem[]) => void;
export type PropertyPathItem = string | number;
export interface ViewModelNode {
  __listeners: Map<string, ViewModelNode>;
  __parent?: ViewModelNode;
  __property?: string;
  __handlers?: ViewModelWatchHandler[];
}
export interface ViewModelCore {
  __parents: ViewModelParent[];
  __notifiable: boolean;
  __related: RelatedListenersMap;
  __setters: Map<string | symbol, (v: unknown) => void>;

  proxy: unknown;
  target: unknown;

  __watch(
    propertyPath?: string | PropertyPathItem | PropertyPathItem[],
    handler?: ViewModelWatchHandler,
    related?: ViewModelCore,
  ): void;
  __unwatch(
    propertyPath?: string | PropertyPathItem | PropertyPathItem[],
    handler?: ViewModelWatchHandler,
    related?: ViewModelCore,
  ): void;
  __notify(propertyArrayPath: string | PropertyPathItem | PropertyPathItem[], immediate?: boolean): void;
  __addRelated(
    origin: ViewModelCore,
    propertyPath: PropertyPathItem | PropertyPathItem[],
    handler: ViewModelWatchHandler,
  ): void;
  __rmRelated(
    origin: ViewModelCore,
    propertyPath: PropertyPathItem | PropertyPathItem[],
    handler: ViewModelWatchHandler,
  ): void;
  __destroy(): void;
}

export type RelatedListenersMap = Map<
  ViewModelCore,
  {
    prop: string | PropertyPathItem | PropertyPathItem[];
    handler: ViewModelWatchHandler;
  }[]
>;

export interface ViewModelObject extends Record<string | number | symbol, unknown> {
  [$$]: ViewModelCore;
}
export type ViewModelArray = ViewModelObject & ViewModelObject[];
export type ViewModelParent = {
  core: ViewModelCore;
  prop: string | number;
};

export function isInnerObj(v: unknown): boolean {
  const clazz = (
    v as {
      constructor: unknown;
    }
  ).constructor;
  return clazz === RegExp || clazz === Date || clazz === Boolean;
}

export function isViewModel(v: unknown): boolean {
  return isObject(v) && $$ in (v as Record<symbol, unknown>);
}

export function isPublicProperty(v: unknown): boolean {
  return isString(v) && (v as string).charCodeAt(0) !== 95;
}

/**
 * @internal
 */
export function getPropertyName(v: PropertyPathItem): string {
  if (isString(v)) {
    return v as unknown as string;
  }
  if (v === null) {
    return 'null';
  }
  if (isUndefined(v)) {
    return 'undefined';
  }
  return v.toString();
}

/**
 * @internal
 */
export function parsePropertyPath(propertyPath: string | PropertyPathItem | PropertyPathItem[]): PropertyPathItem[] {
  return isString(propertyPath as unknown)
    ? (propertyPath as unknown as string).indexOf('.') > 0
      ? (propertyPath as unknown as string).split('.')
      : [propertyPath as unknown as PropertyPathItem]
    : isArray(propertyPath)
    ? (propertyPath as unknown as PropertyPathItem[])
    : [propertyPath as PropertyPathItem];
}

/**
 * @internal
 */
export function addParent(child: ViewModelCore, parent: ViewModelCore, property: string | number): void {
  if (!child.__parents) {
    child.__parents = [];
  }
  child.__parents.push({
    core: parent,
    prop: property,
  });
}

/**
 * @internal
 */
export function removeParent(child: ViewModelCore, parent: ViewModelCore, property: string | number): void {
  if (!child.__parents) {
    return;
  }
  const idx = child.__parents.findIndex((item) => {
    return item.core === parent && item.prop === property;
  });
  if (idx >= 0) {
    child.__parents.splice(idx, 1);
  }
}

/**
 * @internal
 */
export function shiftParent(
  child: ViewModelCore,
  parent: ViewModelCore,
  property: string | number,
  delta: number,
): void {
  if (!child.__parents) return;
  const item = child.__parents.find((it) => {
    return it.core === parent && it.prop === property;
  });
  if (item) {
    (item.prop as number) += delta;
  }
}
