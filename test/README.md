# 测试说明

测试使用 Jest、ts-jest 和 jsdom，直接导入 `src` 源码。组件测试通过运行时接口模拟模板编译后的调用，不依赖编译器产物或真实浏览器。

## 目录

| 目录 / 文件                                                 | 覆盖范围                                                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `vm/array.test.ts`、`vm/object.test.ts`、`vm/watch.test.ts` | 原有 ViewModel 包装、数组操作及监听测试                                              |
| `vm/behavior.test.ts`                                       | 通知合并、取消待执行监听、深浅监听、祖先替换、共享子对象、原始对象身份及数组派生操作 |
| `vm/array-boundaries.test.ts`                               | splice/fill 与原生数组的边界对照、对象父子关系及长度通知合并                         |
| `core/component.test.ts`                                    | bootstrap、根节点、嵌套组件、生命周期、销毁、context 隔离及组件替换                  |
| `core/hook-ref.test.ts`                                     | 当前 host、context hook、expose、组件 watch、挂载和卸载回调、DOM ref                 |
| `core/watch.test.ts`                                        | 路径绑定、布尔转换、表达式合并、动态路径重绑定、事件处理函数更新和解绑               |
| `components/control-flow.test.ts`                           | If、Dynamic、For，含分支清理、key 复用、DOM 移动、空列表和卸载                       |
| `components/lazy-portal.test.ts`                            | Lazy、lazy 工厂、加载失败、卸载后的异步结果、Portal 目标与生命周期                   |
| `components/transition.test.ts`                             | 动画 class、进入和退出、取消、销毁后重建、appear 定时器和 TransitionGroup 延迟删除   |
| `intl/index.test.ts`                                        | 翻译回退、字典加载和缓存、语言监听、参数更新、富文本替换及 IntlWatcher               |
| `hmr/index.test.ts`                                         | 最新函数解析、多实例热替换、props/context 保留及已销毁实例注销                       |
| `util/`                                                     | 类型判断、数组工具、class 名组合、DOM/SVG、事件、调度与错误信息                      |
| `jsx/types.test.ts`                                         | 事件名、插槽、children、ref 和 expose 辅助类型的正反例                               |
| `regressions/`                                              | 之前源码审阅发现的缺陷复现，详见该目录 README                                        |
| `_helper.ts`                                                | 挂载、异步等待、可控 Promise、组件及副作用清理                                       |
| `vite-env-transformer.cjs`                                  | 为 Jest 提供 Vite 的 `import.meta.env.MODE` 语义，使错误分支能验证真实诊断信息       |

`src/index.ts` 和各目录的导出入口通过上述导入覆盖；`src/jsx/index.ts` 的类型契约还需要运行 TypeScript 检查，`src/vite.d.ts` 属于类型声明，不安排运行时断言。

## 运行

```sh
# 全量测试，包含尚未修复的缺陷复现
pnpm test --runInBand

# 正常功能测试
pnpm test test/core test/components test/util test/intl test/hmr test/jsx test/vm --runInBand

# 单个模块
pnpm test test/components/transition.test.ts --runInBand

# 类型检查；同时验证 JSX 中的 @ts-expect-error 反例
pnpm exec tsc --noEmit

# 源码覆盖率，排除声明文件
pnpm test --runInBand --coverage \
  '--collectCoverageFrom=src/**/*.ts' \
  '--collectCoverageFrom=!src/**/*.d.ts'
```

## 当前结果

在首轮 103 个模块测试基础上，再补充 41 个针对未覆盖分支的用例，包括空状态、多根节点列表、异步失败与卸载、动画取消、hook 使用限制及 HMR 边界。新增用例全部通过。

之后完成 13 项局部缺陷修复，并补充数组边界和通知矩阵。`copyWithin` 现已支持变更通知和父子关系维护，新增原生边界、重叠复制与稀疏数组测试。循环数据仍允许创建和赋值，通知传播仅在当前递归链遇环时截断，并验证共享多父路径仍能通知。响应式 `delete` 已实现，对象属性与数组索引删除均维护父子关系并通知监听；数组删除保留长度和空槽。当前全量共 307 个测试，全部通过。OffscreenCanvas 按现代浏览器能力使用。详见 `regressions/README.md`。

数组通知矩阵在 `vm/array-notifications.test.ts`，共 54 个用例：覆盖 `push/pop/unshift/shift/splice/fill/reverse/sort/copyWithin`、索引替换/追加、length 缩短/扩展/清空。检查数组、父对象、索引与长度监听、无操作分支、后续子对象变更及已移除对象解绑，也包含空数组 splice 转调 push 的分支。对外回调次数断言验证异步合并，不等价于统计内部通知函数的调用次数。

`vm/delete.test.ts` 的 12 个用例覆盖属性与深层路径通知、不存在/继承属性、删除失败、共享别名、原型属性显露、访问器、同轮重新赋值、数组空槽及 Symbol 非响应式约定。

`vm/copy-within.test.ts` 验证原生参数语义、重叠复制、稀疏孔洞和复制后的子对象通知；`vm/cyclic-watch.test.ts` 验证自引用、双节点环、后续形成的环、共享别名及绕环路径截断的限制。

```sh
pnpm test test/vm/array-notifications.test.ts --runInBand
```

最近一次修复前的统计采用上方命令的相同范围，包含缺陷复现用例，覆盖率变化为：

| 指标 | 首轮   | 补充后 |
| ---- | ------ | ------ |
| 分支 | 91.49% | 97.42% |
| 函数 | 98.63% | 100%   |
| 行   | 98.31% | 99.78% |

错误工具现在直接通过 Jest 测试并计入覆盖率。测试转换器将 `import.meta.env` 转为读取 `process.env.NODE_ENV` 的 MODE 对象；用例可以选择开发/生产模式，结束后恢复环境变量。

覆盖率不代表没有缺陷；类型文件的行覆盖没有运行时意义。部分剩余分支涉及不可达防御路径或尚未修复的问题，没有为提高百分比修改断言或排除源码。

本轮局部修复涉及 `src`；此前仅增加覆盖率的两轮工作限于测试和 Jest 配置。
