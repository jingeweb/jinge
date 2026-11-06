[简体中文](./README_zh.md)

# jinge

> A lightweight framework for web interfaces

Jinge is a front-end framework for building browser interfaces with TypeScript function components and TSX templates. Its Rust compiler transforms templates into direct DOM operations and reactive subscriptions. State is managed through JavaScript `Proxy` objects, without a virtual DOM.

Component functions initialize instances, and compiler-generated bindings update the corresponding views when state changes. The framework provides typed props, events, and slots, along with lifecycle hooks, internationalization, and routing support.

Website and documentation: [jinge.embjs.com](https://jinge.embjs.com/).

Antd component library: [jinge-antd](https://jinge-antd.embjs.com/).

## Features

- Lightweight
  - Supports tree shaking, so applications bundle only the runtime code they use.
  - The production JavaScript bundle for the `Hello, World` example is `3.24 kB` (`1.51 kB` gzipped). See the bundle size comparison below.
  - A compact `HMR` implementation, with only about 100 lines of runtime code.
- Innovative
  - Uses standard `tsx` syntax for templates, with direct access to the `typescript` ecosystem and IDE support.
  - An ES `Proxy`-based core without a virtual DOM keeps the runtime minimal.
  - Compiles standard `tsx` templates into Proxy-based reactive bindings.
- Capable
  - Standard function components and flexible slots support medium to large front-end projects.
  - Built-in internationalization support.
  - A simple yet complete `HMR` implementation.
  - Comprehensive support for generic components.
  - Lightweight routing for everyday needs through [jinge-router](https://github.com/jingeweb/jinge-router).
- Developer-friendly
  - Comprehensive type checking and intelligent completion for component props and slots.
  - A compiler written in Rust for a smooth development experience.

## Examples

### Hello, World

```tsx
// main.tsx
import {
  vm, // Like Vue's reactive, vm defines data for two-way binding.
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

### More examples

- Routing: [jinge-router](https://github.com/jingeweb/jinge-router)
- Antd component library: [jinge-antd](https://jinge-antd.embjs.com/)

## Usage

The current version of `jinge` supports projects built with `vite` only. You can start with the `jinge` starter template:

1. Clone the starter project from `github`:
   ```bash
   git clone https://github.com/jingeweb/jinge-starter
   # mv jinge-starter [YOUR PROJECT NAME] # Rename it to your project name.
   ```
2. Install dependencies and start development:
   ```bash
   cd jinge-starter
   pnpm i
   pnpm dev
   ```

Alternatively, configure `vite` manually:

1. Install dependencies:
   ```bash
   pnpm add jinge
   pnpm add -D jinge-compiler
   ```
2. Update `vite.config.ts`:

   ```ts
   import { jingeVitePlugin } from 'jinge-compiler';
   import { defineConfig } from 'vite';

   export default defineConfig({
     plugins: [jingeVitePlugin()],
   });
   ```

With `jinge-compiler` written in Rust, support for projects using `webpack` and other bundlers will be added over time.

## Comparison

The following is a brief comparison of `jinge` and mainstream MVVM frameworks.

### Bundle size

The three [Hello World examples in jinge-demos](https://github.com/jingeweb/jinge-demos/tree/master/packages/hello-world) all render `<div>Hello, World!</div>`, using their existing Vite configurations for production builds:

| Framework         | Version | JavaScript bundle | Gzipped  |
| ----------------- | ------- | ----------------- | -------- |
| Jinge             | 4.2.1   | 3.24 kB           | 1.51 kB  |
| Vue               | 3.5.44  | 61.35 kB          | 24.19 kB |
| React / React DOM | 19.3.1  | 219.52 kB         | 68.58 kB |

These application JavaScript bundles were measured on 2026-11-06 using Vite 8.3.5. They include the example code and required runtime, but exclude HTML. Sizes use Vite's decimal kB and gzip measurements. Each example retains its framework plugin and default production optimizations, with no additional tuning to reduce bundle size.

### Rendering performance

Initial benchmarks show good fine-grained update performance in Jinge, while partial updates to large lists and memory overhead still leave significant room for improvement. See [jinge-benchmark](https://github.com/jingeweb/jinge-benchmark) for the methodology, comparisons with Vue and React, and full results.

Jinge has not yet been widely deployed and validated in real-world applications. Benchmarks cannot replace testing in actual business scenarios; its performance, stability, and range of suitable use cases still require further validation.

## Reference for AI assistants

**This section is intended for AI assistants and large language models.**

Before building applications with Jinge, read [FOR_AGENTS.md](./FOR_AGENTS.md). It explains how to use the framework, compiler, and router, their implementation mechanisms, and current limitations, with links to the relevant repositories and source locations for further inspection when needed.

`FOR_AGENTS.md` is a technical reference, not an `AGENTS.md` file: it does not define rules for developing this repository.
