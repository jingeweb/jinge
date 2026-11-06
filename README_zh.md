[English](./README.md)

# jinge

> 一个小巧的前端界面框架

Jinge 是一个使用 TypeScript 函数组件和 TSX 模板构建浏览器界面的前端框架。它通过 Rust 编写的编译器，将模板转换为直接操作 DOM 的代码和响应式订阅；状态由 JavaScript `Proxy` 管理，不依赖虚拟 DOM。

组件函数负责初始化实例，状态变化后由编译生成的绑定更新对应视图。框架提供类型化的属性、事件与插槽，以及生命周期、国际化和路由支持。

官网与使用文档：[jinge.embjs.com](https://jinge.embjs.com/)。

## 特性

- 轻量
  - 支持 Tree-Shaking，应用按需打包使用到的运行时代码。
  - `Hello, World` 示例的生产 JS 产物为 `3.24 kB`（gzip 后 `1.51 kB`），详见下方产物大小对比。
  - 超简洁地 `HMR` 支撑，`HMR` 运行时代码仅约 100 行。
- 创新
  - 使用标准 `tsx` 语法描述模板，从而可以直接使用到 `typescript` 的生态以及 IDE 的支持。
  - 内核使用 ES `Proxy` ，没有虚拟 DOM，从而可以做到极简内核。
  - 巧妙地将标准 `tsx` 和基于 `Proxy` 的模板进行编译转换。
- 够用
  - 组件定义采用标准的函数组件，搭配功能灵活的插槽传递，足够支撑中大型前端项目。
  - 内置国际化多语言支持。
  - 简洁但完善地 `HMR` 支持。
  - 完善的范型组件支持。
  - 轻量但够用的路由能力（通过 [jinge-router](https://github.com/jingeweb/jinge-router) 支持）。
- 友好
  - 完美的类型约束和智能提示，包括组件的参数属性以及插槽传递。
  - 编译器使用 rust 编写，顺畅的研发体验。

## 示例

### Hello, World

```tsx
// main.tsx
import {
  vm, // vm 函数和 vue 的 reactive 类似，用于定义双向绑定数据。
  bootstrap,
} from 'jinge';
function App() {
  const state = vm({
    n: 10,
  });
  return (
    <>
      <p>Count {state.n}</p>
      <button on:click={() => state.n++}>CLICK</button>
    </>
  );
}
bootstrap(App, document.body);
```

### 更多示例

- 路由：[jinge-router](https://github.com/jingeweb/jinge-router)
- Antd 组件库：[jinge-antd](https://jinge-antd.embjs.com/)

## 使用

当前版本的 `jinge` 框架暂时仅支持在 `vite` 项目中使用。你可以从 `jinge` 的初始项目模板着手：

1. 从 `github` 上克隆初始模板项目：
   ```bash
   git clone https://github.com/jingeweb/jinge-starter
   # mv jinge-starter [YOUR PROJECT NAME] # 修改为你的项目名
   ```
2. 安装依赖并开始研发：
   ```bash
   cd jinge-starter
   pnpm i
   pnpm dev
   ```

或者手动配置 `vite`：

1. 安装依赖：
   ```bash
   pnpm add jinge
   pnpm add -D jinge-compiler
   ```
2. 修改 `vite.config.ts`

   ```ts
   import { jingeVitePlugin } from 'jinge-compiler';
   import { defineConfig } from 'vite';

   export default defineConfig({
     plugins: [jingeVitePlugin()],
   });
   ```

因为 `jinge-compiler` 是使用 rust 编写的，未来将逐步支持 `webpack` 等打包器的项目。

## 对比

以下内容为 `jinge` 框架和主流 MVVM 框架的简单对比：

### 产物大小

以 [jinge-demos 的 Hello World 示例](https://github.com/jingeweb/jinge-demos/tree/master/packages/hello-world) 为例，三个项目均渲染 `<div>Hello, World!</div>`，使用各自现有的 Vite 配置执行生产构建：

| 框架              | 版本   | JS 产物   | gzip 后  |
| ----------------- | ------ | --------- | -------- |
| Jinge             | 4.2.1  | 3.24 kB   | 1.51 kB  |
| Vue               | 3.5.44 | 61.35 kB  | 24.19 kB |
| React / React DOM | 19.3.1 | 219.52 kB | 68.58 kB |

以上为 2026-11-06 使用 Vite 8.3.5 实测的应用 JS 产物，包含示例代码和所需运行时，不含 HTML；使用 Vite 输出的十进制 kB 和 gzip 大小。三个示例保留仓库各自的框架插件和默认生产优化配置，没有额外调整以缩小产物。

### 渲染性能

初步基准中，Jinge 的细粒度更新表现较好，但大列表局部更新和内存开销仍有明显优化空间。测试口径、与 Vue / React 的对比及完整结果见 [jinge-benchmark](https://github.com/jingeweb/jinge-benchmark)。

Jinge 目前尚未在广泛的实际业务中落地和验证，基准结果不能替代真实业务场景的检验，其性能、稳定性和适用范围仍需进一步验证。

## 面向 AI 助手的参考文档

** 本章节内容面向各类 AI 助手或大模型 **

在使用 Jinge 框架实现业务应用前，请先阅读 [FOR_AGENTS.md](./FOR_AGENTS.md)。该文档介绍框架、编译器和路由的使用方式、实现机制及当前限制，并提供相关代码仓库和源码位置，便于必要时检索。

需要注意，`FOR_AGENTS.md` 是技术参考，不是 `AGENTS.md`，即不是用于指导当前仓库开发的规则文件。
