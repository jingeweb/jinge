import { Component, ComponentAttributes, RenderFn } from '../core/component';
interface Render {
    _component?: {
        create(attrs: ComponentAttributes): Component;
    };
    _renderFn?: RenderFn;
}
/*****
 * 动态渲染组件 `<dynamic/>`。
 *
 * 通常情况下，可以用 `<if/>` 或 `<switch/>` 组件来根据不同的条件渲染不同的组件，但这种方法在条件分支很多的时候，代码会写的很罗嗦。
 * 而使用 `<dynamic/>` 组件可以动态地渲染某个变量指定的组件。也可以使用更底层地方式，动态地使用指定的渲染函数。比如：
 *
 *
 * ````html
 * <!-- app.html -->
 * <dynamic e:render="{_component: _component}"/>
 * <dynamic e:render="{_renderFn: _renderFn}"/>
 * <button on:click="change"/>
 * ````
 *
 *
 * ````js
 * // app.js
 * import { Component, emptyRenderFn } from 'jinge';
 * import { A, B } from './components';
 * class App extends Component {
 *   constructor(attrs) {
 *     super(attrs);
 *     this._component = A;
 *     this._renderFn = emptyRenderFn;
 *   }
 *   change() {
 *     this._component = B;
 *   }
 * }
 * ````
 */
export declare class DynamicRenderComponent extends Component {
    _r: Render;
    /**
     * current attributes
     */
    _ca: ComponentAttributes;
    /**
     * has watched passed compiler attributes
     */
    _w: boolean;
    constructor(attrs: ComponentAttributes & {
        render: Render;
    });
    get render(): Render;
    set render(v: Render);
    __render(): Node[];
    __update(): void;
}
export {};
