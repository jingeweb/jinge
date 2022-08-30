# jinge

> 一款基于 `Messenger`, `Proxy` 和 `Compiler` 的前端 mvvm 框架

## 引言

`jinge` 是一款基于 `Messenger`, `Proxy` 和 `Compiler` 的前端 mvvm 框架。其中：

* `Messenger` 代表消息驱动（等价于 EventEmmiter）。
* `Proxy` 是实现数据绑定的原理（依赖 es6 的 Proxy）。
* `Compiler` 负责编译模板，以及处理组件对象（现阶段会处理构造函数和模板文件）。

通过以上三个核心概念，`jinge` 框架实现了数据绑定的能力。简单来讲，`jinge` 框架的数据绑定原理是，`当存在赋值行为时，对该赋值行为影响的变量（属性）通过消息广播到 View 层；View 层收到变量（属性）有赋值行为的消息后更新该变量影响到的视图节点`。

该数据绑定的核心，不依赖 angular 那样的 dirty-checking，也不使用 react 那样的 virtual-dom，而是认为，绝大多数情况下，对变量（属性）的赋值都是会导致变量（属性）的值发生变化的，因此可以在赋值行为后立即更新视图。

此外，视图的更新，只会影响到该赋值的变量（属性）相关联的节点，因此`赋值即更新视图`虽然会导致不必要的更新，但并不会过分牺牲性能。

同时，对于默认行为会导致性能问题的极端情况，`jinge` 框架也允许手工编写类的 getter/setter 来精确控制只在变量（属性）值发生变化时才更新视图层。

上述数据绑定和更新的方案在空间复杂度上明显优于 dirty-checking 或
 virtual-dom（基本不需要消耗内存），时间复杂度上也略优于其它方案。但 dom 渲染性能在一次性更新大量数据时，略低于 virtual-dom 方案。

需要注意的是，`jinge` 目前的定位暂时是：只支持`现代浏览器（chrome,ff,edge）的最新版本`。因此暂时只适用于可不考虑浏览器兼容性问题的现代项目。

## 目标和设计

jinge 框架诞生于长期的使用其它框架进行的业务项目的研发过程，因此在设计之初，其目标就包括但不限于：

* 简洁的视图（view）模板。目前将一切都抽象成了 html 里面的`元素（Element)`和`属性（Attribute)`概念，额外加上 es6 的 template string 语法，即构成了 jinge 的 view 层，没有 directive, filter 等更多概念，包括 if/for 等控制逻辑，也统一用`元素（Component Element)`来实现，而不是特别的控制指令。
* 更小的构建包文件大小。目前实现的版本，最简单的 hello world 示例，production 模式下的构建包同其它主流的框架比要小 3～10 倍。
* 组件模板的根节点支持多个节点。目前的主流框架都基本已经实现了这一目标（比如 react >= 16 版本）。
* 渲染后，组件本身不引入到 DOM 里。这个目标是为了，css 样式的编写，只与纯 html tag 有关，能够更好地进行跨框架迁移，或服务端渲染的切换。这个目标主要是对比于 angular 而言。
* 更简单的组件生命周期概念。目前只有三个生命周期，初始化（即构造函数），渲染结束和即将销毁。同时，渲染结束（DOM元素可用）的生命周期函数，应该保证其子组件的 DOM 元素也全部可用。比如，循环组件的渲染结束生命周期，会保证所有循环节点的 DOM 元素已经可用。

## 示例和文档

#### 示例

目前已经完成的示例主要包括两个：

* 一个展示 jinge 框架各方面能力的基本示例的集合，即 jinge-demos 仓库。其中包括一个检验 mvvm 框架基础能力的 TodoMVC 示例。
* 一个完整的 material design ui 组件库（jinge-material），包括丰富的组件和完善的使用文档。这个组件库本身同时也是 jinge 框架的极佳编码示例。

|   |    |
| ---  | ----|
| jinge-demos | https://github.com/YuhangGe/jinge-demos |
| jinge-todo-mvc    | https://github.com/YuhangGe/jinge-demos/tree/dev/08-todo-mvc |
| jinge-material | https://material.jinge.design |

#### 文档

目前 jinge 框架还没有正式开始编写文档，只是在 jinge-demos 仓库里，不同的示例下的 README 会有零散的概念介绍和使用说明。

|   |    |
| ---  | ----|
| 组件和组件别名（Component） | https://github.com/YuhangGe/jinge-demos/blob/dev/09-component-alias/README_zh-cn.md |
| 属性（Attribute） |  https://github.com/YuhangGe/jinge-demos/blob/dev/11-slot/README_zh-cn.md  |
| 数据监听（ViewModel） | https://github.com/YuhangGe/jinge-demos/blob/dev/15-vm-watch/README_zh-cn.md    |
| 国际化多语言（i18n）|  https://github.com/YuhangGe/jinge-demos/blob/dev/16-i18n/README_zh-cn.md |
| 组件作用域样式（Component Style） | https://github.com/YuhangGe/jinge-demos/blob/dev/17-component-scope-style/README_zh-cn.md |
| 路由（Router）| https://github.com/YuhangGe/jinge-demos/blob/dev/06-ui-router/README_zh-cn.md |

## 已知问题

在某些场景下，在 view 层直接渲染函数调用的返回值，可以让 controller 层的代码更精简。

但前文所述的数据绑定和更新方案，在 jinge 框架中具体实现时，暂时无法处理对函数调用的返回值的监听，因此主动牺牲了在 view 模板中直接渲染函数调用返回值的能力。

具体来讲，主流框架(react/angular/vue)在更新 view 层时，都会完整地触发 render 重绘逻辑，因此在 view 模板中可以直接渲染函数调用的返回值，该函数调用在每次重绘时都会被触发，因此可以实现对返回值的监听和更新 view。

但 jinge 使用的方案，除了首次渲染会触发完整的 render 逻辑外，以后的更新，都是当赋值语句触发时，只更新和该赋值变量关联的视图部分 DOM。而函数不是可赋值变量，并且函数和可赋值变量之间的依赖关系，由于 js 语言的动态特性也无法在 compile 阶段精准获悉。因此，如果在 view 层面直接渲染函数调用的返回值，则在 model 层无法准确地触发该函数的重新调用和更新 view。

vue 框架使用了一个巧妙的方式，在 runtime 阶段动态获取函数调用依赖的变量。但一方面，jinge 框架不希望走很多框架互相抄袭概念及实现的路，成为一个换了壳的 vue，因此不会去使用 vue 的方案；另一方面，考虑到在 view 层直接渲染函数调用的返回值，并非实现哪一类功能的必需能力，且有背 view 层尽量简单原则，因此未来也不会在 compile 阶段或 runtime 阶段研究自己的实现方案。

## 待办事项

* 重构 `compiler` 目录下杂乱的编译模块的代码。