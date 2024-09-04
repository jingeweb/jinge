# jinge

> 一个小而美的前端 Web 框架

[English Version Readme](README_en.md)

## 特性

- 轻量
  - 框架打包的库产物非压缩和压缩版分别只有 `~55Kb` 和 `~31Kb`。
  - 极致地 Tree-Shaking 考量，`Hello, World` 项目构建产物仅 `~3Kb`（gzip 后 `~1.4Kb`）。
  - 超简洁地 `HMR` 支撑，`HMR` 运行时代码仅约 100 行。
- 创新
  - 使用标准 `tsx` 语法描述模板，从而可以直接使用到 `typescript` 的生态以及 IDE 的支持。
  - 内核使用 ES `Proxy` ，没有虚拟 DOM，从而可以做到极简内核。
  - 巧妙地将标准 `tsx` 和基于 `Proxy` 的模板进行编译转换。
- 够用
  - 组件定义采用标准的函数组件，搭配功能灵活的插槽传递，足够支撑中大型前端项目。
  - 简洁但完善地 `HMR` 支持。
  - 完善的范型组件支持。
- 友好
  - 完美的类型约束和智能提示，包括组件的参数属性以及插槽传递。
  - 编译器使用 rust 编写，顺畅地研发体验。

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
      <button onClick={() => state.n++}>CLICK</button>
    </>
  );
}
bootstrap(App, document.body);
```

### 更多示例

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
   import { defineConfig } from 'vite';
   import { jingeVitePlugin } from 'jinge-compiler';

   export default defineConfig({
     plugins: [jingeVitePlugin()],
   });
   ```

因为 `jinge-compiler` 是使用 rust 编写的，未来将逐步支持 `webpack` 等打包器的项目。

## 对比

以下内容为 `jinge` 框架和主流 MVVM 框架的简单对比：

### 产物大小

### 渲染性能
