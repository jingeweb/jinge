import { Component } from '../../core';

export const ELEMENT = Symbol('ELEMENT');
export class ForEach<T> extends Component {
  index: number;
  isFirst: boolean;
  isLast: boolean;
  [ELEMENT]: T;

  constructor(item: T, index: number, isLast: boolean) {
    super();

    // 此处不能直接使用 this.each = item，因为如果是 Public propery 的更新，会自动把 item 转成 ViewModel
    // 但 For 组件支持渲染非 ViewModel 数据，当数据量很大时，必须阻止自动转成 ViewModel 数据。
    this[ELEMENT] = item;

    this.index = index;
    this.isFirst = index === 0;
    this.isLast = isLast;
  }

  get each() {
    return this[ELEMENT];
  }
}
