# jinge

> 一个小巧的前端界面框架

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
      <button onClick={() => state.n++}>CLICK</button>
    </>
  );
}
bootstrap(App, document.body);
```

### 更多示例

- 经典的 [Todo MVC](<>)
- 路由：[router-demo](<>)
- 示例集合：[jinge-demos](<>)
- UI 组件库：[jinge-antd](<>) `[规划中]`

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

## 循环引用与 watch

`vm()` 允许数据存在循环引用，也允许通过赋值建立循环。变更通知沿父对象关系传播时，如果同一个对象在当前递归链中再次出现，会停止这条路径，避免无限递归；共享对象的其他父路径仍正常通知。

通知不会重复绕环，因此不保证经过循环别名的任意深度路径监听。需要监听环内对象时，直接监听该对象的属性：

```ts
const raw: { n: number; self?: unknown } = { n: 0 };
raw.self = raw;
const state = vm(raw);

// 直接监听目标对象，正常接收 n 的变化。
vmWatch(state, 'n', (n) => console.log(n));

// 不依赖 ['self', 'n']、['self', 'self', 'n'] 等需要重复绕环的通知路径。
state.n++;
```

## 对比

以下内容为 `jinge` 框架和主流 MVVM 框架的简单对比：

### 产物大小

[TODO]

### 渲染性能

[TODO]

## 发布与版本更新

创建 GitHub Release 或手动运行 `.github/workflows/ci.yml`，会依次安装锁定依赖、
执行 lint/类型检查和全部测试、构建 dev/prod 运行时及类型声明，最后发布 npm 包。
已发布的同版本会跳过。npm 侧需为此工作流配置 trusted publishing，
或提供有发布权限的 `NODE_AUTH_TOKEN` 仓库 secret。

```sh
npm version patch      # 或 pnpm release:patch；更新版本、提交并创建 vX.Y.Z tag
npm version minor      # 也支持 major 等 npm version 参数
```

`patch-version` 与 compiler 保持一致，作为 `npm version patch` 的别名。
jinge 只有主包，版本由 npm 自带的 version 命令维护，无需额外同步脚本。
`pnpm-lock.yaml` 不记录主包自身版本，修改版本后仍可使用 frozen lock 安装。
上述命令不推送到远端或创建 GitHub Release；提交和 tag 推送后再创建 Release 触发发布。
