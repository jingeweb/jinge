# Jinge reference for AI assistants

This document describes how to build applications with Jinge and how its framework, compiler, and router work. It is a technical reference, not an `AGENTS.md` file, a contribution policy, or instructions governing an agent's work. It does not replace the user's requirements or repository-specific development instructions.

The APIs and limitations below were checked against Jinge/compiler 4.2.1 and router 4.2.0. Check the installed versions when behavior differs. Examples use TypeScript and TSX. Public APIs are distinguished from compiler-generated internals; most application work should not require reading source.

## Contents

1. [Repositories and packages](#repositories-and-packages)
2. [Execution model](#execution-model)
3. [Application setup](#application-setup)
4. [State and subscriptions](#state-and-subscriptions)
5. [Components, events, slots, and refs](#components-events-slots-and-refs)
6. [Control flow and built-in components](#control-flow-and-built-in-components)
7. [Internationalization](#internationalization)
8. [Router](#router)
9. [Implementation map](#implementation-map)
10. [Common mistakes and current limits](#common-mistakes-and-current-limits)

## Repositories and packages

| Role                                                               | npm package      | Repository                                      |
| ------------------------------------------------------------------ | ---------------- | ----------------------------------------------- |
| Runtime, reactive state, built-in components, JSX types, i18n      | `jinge`          | https://github.com/jingeweb/jinge               |
| Rust/SWC template compiler, native bindings, Vite plugin, i18n CLI | `jinge-compiler` | https://github.com/jingeweb/jinge-rust-compiler |
| Browser SPA router                                                 | `jinge-router`   | https://github.com/jingeweb/jinge-router        |
| Working application examples                                       | —                | https://github.com/jingeweb/jinge-demos         |

The compiler repository is named **jinge-rust-compiler**, even though the npm package and usual local checkout directory are named **jinge-compiler**. The framework's `src/index.ts` is the public export entry. Repository links in this reference describe source locations, not a requirement to check out sibling repositories.

## Execution model

Jinge is not React. Similar-looking TSX has different execution semantics:

1. A function component runs to initialize an instance and create its DOM.
2. The compiler recognizes template expressions and generates subscriptions to their reactive paths.
3. `vm()` mutations notify those subscriptions. Updates are batched; the affected text, attribute, event binding, or control-flow region is updated directly.
4. Conditional branches, list entries, and dynamic components own child instances. Removing one disposes its subscriptions, refs, lifecycle callbacks, and DOM.

There is no virtual DOM diff for the whole component and no render-time automatic dependency collector. A helper function's internal reads do not become template dependencies merely because the template calls it. Arbitrary local variables and derived values do not become reactive automatically.

```tsx
import { vm } from 'jinge';

function Counter() {
  const state = vm({ count: 0 });
  const snapshot = state.count; // Initialized once.
  return (
    <>
      <p>
        Live: {state.count}; initial: {snapshot}
      </p>
      <button on:click={() => state.count++}>Increment</button>
    </>
  );
}
```

## Application setup

Install `jinge`, plus `jinge-compiler`, `vite`, and `typescript` as build dependencies. Install `jinge-router` when routing is needed. The complete minimal application is in [README.md](./README.md#quick-start).

```ts
// vite.config.ts
import { jingeVitePlugin } from 'jinge-compiler';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [jingeVitePlugin()],
});
```

TypeScript should use `jsx: "preserve"`, `moduleResolution: "Bundler"`, DOM libraries, and normally `noEmit: true`. Do not configure React JSX transforms, a React JSX import source, or React hooks. Import Jinge JSX helper types from `jinge`.

`bootstrap(App, element, props?, context?)` mounts a function component and returns its host, including exposed methods. A non-body target is a **placeholder replaced by the rendered nodes**, not a permanent React-style root container. Passing `document.body` appends the nodes. There is no hydration step.

The Vite plugin transforms `.tsx` templates and, where needed, `.ts` files. Development defaults to the `jinge/dev` and `jinge-router/dev` entries and injects HMR support. Production defaults to normal package entries. `importAlias: 'source'` is available for framework integration work; application code normally imports from `jinge` / `jinge-router`.

Keep a single resolved Jinge runtime across an application and its router/component dependencies. Multiple linked copies or a mixture of source/dev/prod runtime instances can split hook state and context symbols. Inspect resolved paths when local linking produces missing-context errors; Vite `resolve.dedupe` may help, but is not a substitute for consistent aliases and dependency resolution.

## State and subscriptions

### Reactive objects

```ts
import { nextTick, vm, vmIgnore, vmRaw, vmWatch } from 'jinge';

const state = vm({ user: { name: 'Ada' }, items: [{ id: 1, label: 'First' }] });
state.user.name = 'Grace';
state.items.push({ id: 2, label: 'Second' });
await nextTick();

const raw = vmRaw(state);
const external = vmIgnore({ libraryHandle: 'opaque' });
const stop = vmWatch(state, ['user', 'name'], (name, previous) => {
  console.log(name, previous);
});
// Call stop() when the standalone subscription is no longer needed.
```

`vm()` recursively wraps eligible objects and arrays. Repeated calls for the same raw object return the same proxy. Mutate the VM rather than the original raw object; raw mutations bypass notifications. `vmRaw()` returns the underlying data, not a snapshot. `vmIgnore()` marks an object to stay outside wrapping.

DOM nodes and certain native objects, including `Date` and the supported native `Temporal` classes, are kept opaque. Replace a property to notify a change, e.g. `state.date = new Date()`. Mutating a `Date`'s internals does not trigger a property notification. Temporal support in `vm()` does not provide Temporal to browsers that lack it. Do not assume `Map`, `Set`, every class instance, or Symbol-keyed properties have ordinary object/array reactive semantics.

Cyclic state is supported, but propagation stops when an object is revisited on the current notification path. Watch an object directly instead of relying on paths repeatedly traversing a cycle.

### Explicit subscriptions and lifecycle

Inside a component, `watch()` registers a subscription owned by that instance:

```tsx
import { onMount, onUnmount, vm, watch } from 'jinge';

function Search() {
  const state = vm({ query: '', ticks: 0 });
  watch(
    state,
    'query',
    (query, previous) => {
      console.log(query, previous);
    },
    { immediate: true },
  );

  onMount(() => {
    const timer = window.setInterval(() => state.ticks++, 1000);
    return () => window.clearInterval(timer);
  });
  onUnmount(() => console.log('Search disposed'));

  return <input value={state.query} on:input={(event) => (state.query = event.target.value)} />;
}
```

| API                                                    | Behavior                                                          |
| ------------------------------------------------------ | ----------------------------------------------------------------- |
| `watch(vm, 'property', handler, options?)`             | Watches a property; released on component unmount.                |
| `watch(vm, ['nested', 'property'], handler, options?)` | Watches a path, including changes to its ancestors.               |
| `watch(vm, handler, { immediate? }?)`                  | Deep subscription to the VM.                                      |
| `vmWatch(...)`                                         | Corresponding standalone forms; returns an unsubscribe function.  |
| `onMount(callback)`                                    | Runs after mounting; a returned cleanup function runs on unmount. |
| `onUnmount(callback)`                                  | Registers cleanup.                                                |
| `nextTick()`                                           | Waits for the current queued update round.                        |

Property/path options include `immediate` and `deep`, both false by default. Use `deep: true` when a side effect must observe nested mutations rather than just replacement. Deep old/new values can be the same reference; they are not snapshots. Notifications are batched rather than emitted synchronously for each assignment. A callback can receive a changed-path argument; it is a coalesced notification, not a complete mutation log.

Call component hooks during synchronous component initialization, not for the first time inside an event, timer, or after `await`. `vmWatch()` is the option outside that context. `nextTick()` does not wait for network work, transitions, or additional update rounds scheduled by a watcher callback.

### Dependency boundaries

Prefer direct paths rooted in a VM:

- `{state.user.name}` tracks that path.
- `const name = state.user.name; ... {name}` is a snapshot.
- `{format(state.count)}` exposes `state.count` as a dependency; keeping the formatter pure avoids surprises.
- `{format()}` does not discover `state.count` read inside `format`.
- `{state.rows.includes(state.selected)}` preserves the method receiver, but does not mean every nested mutation of `rows` is automatically a deep dependency. For derived collections or aggregate state, use an explicit appropriate `watch()` and a VM result.
- `{a.b.x}` with `const a = { b: vm({ x: 0 }) }` starts at a plain object. Do not rely on it tracking the nested VM through that plain root; put the root in `vm()` or bind directly to the VM.

Avoid destructuring reactive props or state into locals used by templates. The compiler has scope-aware diagnostics for some lost-reactivity patterns, but absence of a warning does not make an expression reactive.

## Components, events, slots, and refs

### Props and events

Use named, typed function components. Keep reactive reads as `props.value` inside the template; values calculated during initialization remain initial values unless updated explicitly. Passing `value={state.value}` lets the compiler establish a binding to the child props. A nested object literal such as `options={{ value: state.value }}` is not a general deep-reactive prop factory; pass a stable VM object when nested fields must stay reactive.

```tsx
import type { WithEvents } from 'jinge';

function SaveButton(props: { disabled?: boolean } & WithEvents<{ save(): void }>) {
  return (
    <button disabled={props.disabled} on:click={() => props['on:save']?.()}>
      Save
    </button>
  );
}
```

DOM events use `on:click`, `on:input`, `on:submit`, etc., with native events. Use `event.preventDefault()` and `event.stopPropagation()` explicitly. `event.target` has the element type in Jinge's event helper types. Capture handlers use forms such as `on:clickCapture`; `on:doubleClick` maps to `dblclick`.

Use `className`, `htmlFor`, and CSS strings such as `style="display:flex;gap:8px"` or ``style={`width:${state.width}px`}``. Do not assume React's object-style conversion exists. Known DOM properties such as `value`, `checked`, `disabled`, `hidden`, and `inert` are assigned as properties; other attributes follow compiler/runtime attribute handling. Form bindings are explicit: writing `value={state.name}` alone does not listen for user input.

### Default, named, and scoped slots

Children are compiled rendering slots, not React elements to clone or inspect. `JNode` and the helper types describe authored content; compiled slots are rendering functions passed in props.

```tsx
import type { JNode, WithChildren, WithSlots } from 'jinge';

function Card(props: { title: string } & WithSlots<{ default?: JNode; footer?: JNode }>) {
  return (
    <section>
      <h2>{props.title}</h2>
      <div>{props.children ?? <p>No content</p>}</div>
      <footer>{props['slot:footer'] ?? 'No footer'}</footer>
    </section>
  );
}

function Field(props: WithChildren<(field: { id: string }) => JNode>) {
  return <label>{props.children({ id: 'profile-name' })}</label>;
}

function SlotExample() {
  return (
    <Card title="Profile" slot:footer={<small>Saved locally</small>}>
      <Field>{(field) => <input id={field.id} />}</Field>
    </Card>
  );
}
```

Named slots are passed as `slot:name={...}`. `props.children` is the authored spelling of the default slot (`slot:default`). `WithChildren`, `WithOptChildren`, and `WithSlots` provide slot typings. `WithEvents` maps event names to `on:name` props; `WithPropSlot` describes mutually exclusive text and slot forms.

The compiler recognizes default-slot calls from the actual props binding, not the variable's spelling. A plain data object's unrelated `children()` method is not automatically a rendering slot. For authored components, keep slot access direct rather than assuming arbitrary aliases preserve slot recognition.

Slots are passed statically. Reactive expressions inside a slot still update, but replacing/adding/removing a slot renderer later does not dynamically select and mount a new template. Keep the slot stable and put conditional content inside it, or use `Dynamic` for a changing component type. Forward existing slots directly, e.g. `slot:footer={props.children}`.

### Refs, exposed methods, and context

```tsx
import { expose, onMount, ref, type WithExpose } from 'jinge';

function FocusInput(props: WithExpose<{ focus(): void }>) {
  const input = ref<HTMLInputElement>();
  expose<typeof FocusInput>({ focus: () => input.value?.focus() });
  return <input ref={input} />;
}

function RefExample() {
  const field = ref<typeof FocusInput>();
  onMount(() => field.value?.focus());
  return <FocusInput ref={field} />;
}
```

A callback ref receives the DOM node/exposed instance on creation and `undefined` on cleanup. Object refs use `.value`. `expose()` adds methods to the component host; it does not expose an automatic class instance or reactive props object. Prefer ref callbacks/objects to global `id` lookups when integrating fields.

`context(key, value)` provides a value to descendant components and `context<T>(key)` reads it. Use a shared Symbol or stable string key, provide during initialization before rendering descendants, and use a VM value if consumers must observe changes. `firstDOM()` and `lastDOM()` access the instance's boundary nodes; multi-root components need not have a single element root.

## Control flow and built-in components

Keep JSX in the component’s final template return or a supported slot/render callback. JSX assigned to an arbitrary local variable, standalone JSX expressions, and early JSX returns are not general-purpose React-style patterns; use conditional expressions inside the final template instead.

Template ternaries and logical expressions (`&&`, `||`, `??`) are compiled into control-flow regions where appropriate. Conditional structure follows generated dependencies; ordinary `if` statements executed during component initialization do not rerun after mutation. The compiler implements control-flow syntax rather than React rendering semantics, so do not depend on React-specific treatment of falsy children.

```tsx
import { vm } from 'jinge';

function List() {
  const state = vm({ visible: true, rows: [{ id: 1, name: 'Ada' }] });
  return (
    <>
      {state.visible && <p>Visible</p>}
      <ul>
        {state.rows.map((row, index) => (
          <li key={row.id}>
            {index}: {row.name}
          </li>
        ))}
      </ul>
    </>
  );
}
```

Template `.map()` becomes the built-in `For`. Prefer simple identifier callback parameters and a direct JSX return. Use stable, unique item-property keys such as `key={row.id}` on the returned root. Index keys follow positions, not logical item identity; arbitrary key expressions are not all supported. A `key` outside a compiled list is not React's general remount mechanism.

Explicit `If` uses `expect={state.visible}` with a default slot and optional `slot:else`. Explicit `For` uses `loop={state.rows}`, a key property such as `key="id"`, and a slot receiving `{ data, index }`. `KEY_DATA` and `KEY_INDEX` select identity/position keys. There are no `isFirst` / `isLast` slot fields; calculate them with the index and current length. Keyed updates reuse item hosts; item-local state therefore follows the chosen key.

| Built-in          | Use                                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `If`              | Explicit conditional rendering; template conditionals normally supply the syntax sugar.                                                           |
| `For`             | Reactive list rendering; template `.map()` normally supplies the syntax sugar.                                                                    |
| `Dynamic`         | `<Dynamic fc={state.component} />` changes the mounted function component. Additional props are forwarded.                                        |
| `Lazy`            | Loads a function component through `loader: () => Promise<FC>`, with optional `slot:loading` / `slot:error`.                                      |
| `lazy`            | `lazy(() => import('./Page').then(module => module.Page))` creates a loadable component. The loader returns the component, not the module object. |
| `Portal`          | Renders children into `target` (default `document.body`), with cleanup tied to the owning host. Target selection is initial configuration.        |
| `Transition`      | CSS enter/leave lifecycle controlled by `isEnter`; configure classes, `appear`, `destroyAfterLeave`, and `on:afterLeave` as needed.               |
| `TransitionGroup` | List transition support; inspect its current props before integrating complex keyed animations.                                                   |

A `Lazy` resolution after disposal is ignored. When using `Transition`, keep the transition owner mounted while a leave animation runs; `destroyAfterLeave` can dispose its contents afterwards. Removing an outer conditional immediately also removes the transition owner.

## Internationalization

Enable compiler support explicitly:

```ts
jingeVitePlugin({ intl: true });
// Or intl: { dropDefaultText: false } to retain source text in production.
```

Use `t('Source message')`, `t('Hello {name}', { name: state.name })`, or an explicit stable key via the third argument `{ key: 'greeting' }`. Source messages must be statically extractable, not constructed from dynamic strings. Production defaults to dropping source fallback text; missing translations can therefore surface as keys. Application builds can enforce translation completeness.

```sh
pnpm exec intl-extract --lang zh-CN,en --csv intl/translate.csv src
# Fill the translation columns in the CSV.
pnpm exec intl-compile --csv intl/translate.csv --output-dir intl
```

Generated dictionaries are TSX modules and must also pass through the Jinge compiler. Initialize before mounting:

```ts
import { bootstrap, intlInit } from 'jinge';

import { App } from './App';

const dictionaries = import.meta.glob<{ default: import('jinge').Dict }>('../intl/*.tsx');
await intlInit({
  defaultLocale: 'en',
  dictLoader: async (locale) => {
    const load = dictionaries[`../intl/${locale}.tsx`];
    if (!load) throw new Error(`Unsupported locale: ${locale}`);
    return (await load()).default;
  },
});
bootstrap(App, document.getElementById('app')!);
```

`intlSetLocale(locale)` asynchronously loads a dictionary if necessary and notifies locale listeners; `intlGetLocale()` reads the active locale. Compiler-generated template bindings can update on locale changes. A `t()` call whose return value was stored in a plain local or state property remains a value from that call; it is not automatically recomputed on a later locale change.

Rich messages use named tags in the message and render callbacks in the parameter object. Callbacks remain in business code so that their closures stay valid; generated language modules describe the translated structure and dispatch tags through passed slots. Their shared `T_Tag` helper is per language module, not one global singleton. Generated `T_...` function names are internal allocation details, not message keys or application APIs. Preserve generated headers/reserved identifiers rather than hand-authoring generated modules.

## Router

### Minimal HTML5 application

```tsx
import { bootstrap, watch } from 'jinge';
import { createRouter, Router, RouterHref, RouterView, useParams, useQuery } from 'jinge-router';

function Home() {
  return <h1>Home</h1>;
}
function User() {
  const params = useParams<{ id: number }>();
  const query = useQuery();
  watch(params, 'id', (id) => console.log('Load user', id), { immediate: true });
  return (
    <p>
      User {params.id}, tab {query.tab ?? 'overview'}
    </p>
  );
}
function NotFound() {
  return <h1>Page not found</h1>;
}

const router = createRouter({
  mode: 'html5',
  routes: [
    { path: '/', component: Home },
    { path: '/users/:id<num>', component: User },
    { path: '/old-home', redirectTo: '/' },
    { path: '/*', component: NotFound },
  ],
});
function App() {
  return (
    <Router router={router}>
      <nav>
        <RouterHref to="/">Home</RouterHref>
        <RouterHref to="/users/1">User</RouterHref>
      </nav>
      <RouterView />
    </Router>
  );
}
bootstrap(App, document.getElementById('app')!);
```

`Router` owns the browser listeners and provides context. `RouterView` registers an outlet at its nesting depth. Router hooks must run during component initialization within `Router`; `useParams()` belongs in an outlet page or its descendants.

### Paths, layouts, and deployment

- `createRouter({ routes, mode?, baseHref? })` defaults to HTML5 and `/`.
- `:name` yields a string; `:id<num>` accepts digit-only segments and yields a number. The TypeScript generic alone does not perform conversion.
- A trailing `*` matches remaining path segments without capturing a parameter. `/files/*` does not also match `/files`. A wildcard cannot be used on a parent route with `children`.
- Ordinary routes are tried before wildcards; longer wildcard prefixes win. Same-priority routes retain declaration order, so write `/users/new` before `/users/:name`.
- A parent `children` array defines relative child paths. The parent layout renders its own `RouterView`. One child without `path` is an index route. A parent without `component` delegates through an implicit outlet.
- `redirectTo` targets a router-root path. `redirectChild` appends a child path when the parent itself is visited. Both replace history; avoid redirect cycles.
- An unmatched outlet is cleared; add `/*` for a fallback page.

For `baseHref: '/app'`, navigate to `/users/1`, not `/app/users/1`; the router supplies the prefix. HTML5 direct visits and refreshes require a server fallback to the application's HTML. Static asset prefixes (e.g. Vite `base`) are configured separately. A custom domain serving the app at its root needs `/`, not an automatic repository-name prefix. GitHub Pages needs an explicit deep-link fallback strategy.

In hash mode, the route and router query live after `#`, e.g. `/index.html#/app/users/1?tab=activity` when `baseHref` is `/app`. A query before `#` is not the router query.

### Navigation and reactive route state

`useNavigate()` returns a function accepting a router-root string path (with optional query), or a numeric history delta. Use `navigate('/users/2')`, `navigate('/login', { replace: true })`, and `navigate(-1)`. Parent-relative `navigate('..')` is not implemented. Use ordinary anchors for external URLs.

`useParams<T>()` returns a stable VM for the current outlet depth, with ancestor params merged in; child names override ancestor names. `useQuery()` returns the router-wide query VM. Query values are decoded strings, repeated keys take the first value, and missing keys read as `undefined`.

Changing only params or query **reuses the matched page instance**. Read `params.id` / `query.tab` directly in templates, and use `watch()` for data fetching or other side effects. Initial reads and destructured locals do not rerun. Mutating these VMs does not navigate; update the URL through navigation. Cancel or disregard stale async requests when params change.

`RouterHref` renders an anchor with `to`, `className`, `activeClass`, and `exactActiveClass`; it is not an arbitrary anchor-attribute passthrough. `RouterLink` supplies a slot with `{ href, active, exactActive }` for custom markup and supports `replace`, `open`, `noEvent`, and `noActive`.

```tsx
import { RouterLink } from 'jinge-router';

function HelpLink() {
  return (
    <RouterLink to="/help" noEvent noActive>
      {(link) => (
        <a href={link.href} target="_blank" rel="noopener noreferrer">
          Help
        </a>
      )}
    </RouterLink>
  );
}
```

Default automatic click handling attaches to the slot's first root DOM node. Use `noEvent` when native anchor behavior or custom integration is required. For active-state matching, prefer canonical `to` paths without query strings; query targets and redirects are not resolved into canonical active paths. A parent link can stay active for descendants; exact active also requires equal matched depth. `noActive` is chosen at creation, and `noEvent` at mount.

There are currently no built-in navigation guards, route loaders, named routes, parallel/named outlets, SSR, or parent-relative navigation. Model authentication and data loading explicitly rather than inventing APIs with those names.

## Implementation map

The following explains generated behavior and points to the smallest useful source areas. These are lookup paths, not APIs that application code normally calls.

### Runtime repository

| Location                                                      | Responsibility                                                                                          |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/vm/proxy.ts`, `object.ts`, `array/`                      | VM identity cache, proxy wrapping, property/array mutations, raw data synchronization.                  |
| `src/vm/core.ts`, `watch.ts`                                  | Parent links, native-object exclusions, path/deep subscriptions, batched propagation, cycle protection. |
| `src/core/component.ts`, `common.ts`                          | `ComponentHost`, root nodes and non-root child hosts, context, mount/disposal, ref cleanup.             |
| `src/core/watch.ts`                                           | Compiler-facing path/expression/method watchers and DOM/event binding subscriptions.                    |
| `src/core/render_fns.ts`, `bootstrap.ts`, `hook.ts`, `ref.ts` | Rendering entry points and public lifecycle/ref APIs.                                                   |
| `src/components/`                                             | Conditional/list/dynamic/lazy rendering, portals, transitions.                                          |
| `src/jsx/index.ts`                                            | Authored JSX, event, slot, ref, and component helper types.                                             |
| `src/intl/index.ts`, `src/hmr/index.ts`                       | Runtime dictionaries/locale notifications and development HMR.                                          |

A `ComponentHost` records root DOM/child hosts and nearest non-root child components, not a virtual copy of the entire DOM tree. It owns disposal callbacks and context. Compiled slot renderers use their own hosts. Destroying a region must clear subscriptions and scheduled updates as well as remove nodes.

`PathWatcher` follows a VM property path. `DymPathWatcher` composes paths with reactive computed keys. `ExprWatcher` combines dependency values and reevaluates an expression. `MethodPathWatcher` tracks both a method and its receiver and calls it with the correct `this`; equal function identities on a replaced receiver still require receiver tracking. This does not add deep tracking of a method's hidden reads. `watchForRender` applies the initial value, wires notifications, and registers cleanup on the owning host. These exported helpers are compiler/runtime plumbing, not a public computed-state API.

### Compiler repository

Source base: https://github.com/jingeweb/jinge-rust-compiler/tree/main

| Location                                                     | Responsibility                                                                 |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `ts/vite-plugin.ts`                                          | Build/serve integration, dev/source aliases, HMR injection, i18n options.      |
| `ts/binding.ts`, `src/lib.rs`                                | Platform-native binding loading and compiler entry.                            |
| `src/visitor.rs`, `scope.rs`, `reserved.rs`                  | Component traversal, lexical binding/scope handling, reserved-name validation. |
| `src/parser/jsx.rs`, `component.rs`, `tpl.rs`                | JSX/host creation and render statements.                                       |
| `src/parser/expr.rs`, `cond.rs`                              | Dependency expressions and conditional lowering.                               |
| `src/parser/map.rs`, `map_key.rs`                            | List lowering, callback-binding replacement, supported key extraction.         |
| `src/parser/attrs.rs`, `src/parser/slot.rs`, `src/common.rs` | Props, DOM properties/events, slot recognition, shared names/tables.           |
| `src/parser/intl.rs`, `ts/intl/`, `ts/cli/`                  | Translation lowering, source extraction, dictionary compilation, CLI.          |
| `TODO.md`, `test/`                                           | Planned capabilities, compiler fixtures, integration and browser regressions.  |

Conceptually, `<span>{state.count}</span>` becomes element creation plus a path subscription updating a text node. A reactive child prop becomes a stable attrs VM with a subscription assigning that prop. Ternaries become `If` regions, and template `.map()` becomes `For` with per-item VM slot parameters. Generated imports and temporary names contain `$jg$`; they are not authored identifiers.

Compiler dependency analysis uses syntax and lexical binding identity; it is not whole-program TypeScript type analysis. Not every JavaScript expression has a reactive equivalent. For low-level integration, `loadCompiler({})` returns the native compiler with `transform(filename, type, code, sourcemap, intl)`; type `1` is TS and `2` is TSX, while intl `0/1/2` means disabled / keep source fallback / drop source fallback. Application builds normally use the Vite plugin instead.

### Router repository

Source base: https://github.com/jingeweb/jinge-router/tree/main

| Location                                                           | Responsibility                                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `src/core/path.ts`, `route.ts`                                     | Path segments, parsed routes, matching order and params.                              |
| `src/core/router.ts`, `helper.ts`, `navigate.ts`                   | Router core, stable query/params VMs, matching updates, history and URL construction. |
| `src/core/view.ts`, `src/components/view.ts`                       | Outlet registration and replacing the changed route suffix.                           |
| `src/components/router.tsx`, `link.tsx`, `href.tsx`, `src/hook.ts` | Context/browser listener lifecycle, links, public hooks.                              |

Navigation compares the old and new matched route-definition chains, retains the common prefix, updates the corresponding params/query VMs, and replaces the changed suffix through registered outlets. Params are not page props and are not a signal to rerun a retained component function. Hooks use Jinge context; duplicate Jinge instances can therefore break router integration.

## Common mistakes and current limits

| Symptom or attempted pattern                           | What to check/use                                                                                                                                                                                                 |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A state change does not update text                    | Use `vm()` and direct VM paths; remove snapshot locals and hidden helper dependencies.                                                                                                                            |
| A page does not refetch after `/users/1` → `/users/2`  | Watch `params.id`; the matched page is reused.                                                                                                                                                                    |
| Controlled input displays state but does not update it | Add `on:input` / `on:change`; binding is not automatic two-way event wiring.                                                                                                                                      |
| A later-rendered slot never appears                    | Slots are static; put conditional content inside a stable slot or use `Dynamic`.                                                                                                                                  |
| DOM reads see old values                               | Await `nextTick()` for the current update round.                                                                                                                                                                  |
| React-style hooks/effects/JSX runtime fail             | Use Jinge `vm`, `watch`, lifecycle hooks, and `jsx: preserve`.                                                                                                                                                    |
| A member call loses expected reactivity                | Method receivers are preserved, but hidden reads/deep mutations still need explicit dependencies.                                                                                                                 |
| A nested VM under an ordinary root is not tracked      | Make the root reactive or bind directly to the VM.                                                                                                                                                                |
| CSS object props do not behave like React              | Supply CSS strings; object-style compilation remains planned work.                                                                                                                                                |
| JSX in an early return or local variable fails         | Keep one final template return and express conditional structure inside it.                                                                                                                                       |
| Spread props fail                                      | Current support is a single component spread from an identifier, e.g. `<Child {...attrs} />`. DOM spreads, member-expression spreads, multiple spreads, and merged explicit props are not supported.              |
| Optional computed access fails to compile              | Nonliteral computed keys protected by optional chaining, e.g. `state.obj?.[state.key]`, are diagnosed rather than evaluated eagerly. Literal optional keys are supported. Use a safe explicit branch when needed. |
| A generated-name diagnostic appears                    | Do not declare/reference identifiers containing `$jg$`; generated language files have a specific controlled exemption.                                                                                            |
| No compiler warning, but a derived value is stale      | Diagnostics are not dependency inference; model derived state with explicit subscriptions.                                                                                                                        |
| Missing router context during linked-package work      | Resolve all participants to the same runtime and matching import entry.                                                                                                                                           |
| Direct HTML5 route returns 404                         | Configure the host's HTML fallback and the correct asset/router base paths.                                                                                                                                       |

Hydration, general JSX prop merging, dynamic slot replacement, React-style object CSS conversion, and automatic cross-function computed dependency analysis are not implemented features. Compiler TODOs describe proposals, not APIs to generate. Read the relevant package's current source/tests when an application requires behavior beyond this reference.
