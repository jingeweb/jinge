# 运行时缺陷复现

这些测试对应本次源码审阅发现的问题，断言的是期望的正确行为。
局部修复、copyWithin、循环通知及 delete 的复现用例均已通过。不要求兼容缺少 OffscreenCanvas 的旧环境。

在 `jinge` 项目目录执行：

```sh
# 运行全部复现用例
pnpm test test/regressions --runInBand

# 单独查看列表更新问题
pnpm test test/regressions/for.test.ts --runInBand

# 运行原有测试
pnpm test test/vm --runInBand
```

| 文件                | 覆盖问题                                                                          |
| ------------------- | --------------------------------------------------------------------------------- |
| `vm.test.ts`        | 索引扩展的 length 通知、splice 负索引与省略删除数量、fill 范围、delete 与循环引用 |
| `for.test.ts`       | 直接替换列表元素、无 key 列表追加项的索引                                         |
| `watch.test.ts`     | 动态路径监听卸载、销毁后重新注册、普通数组搭配响应式索引                          |
| `component.test.ts` | Transition 监听清理、渲染异常后的当前组件上下文                                   |
| `dom.test.ts`       | capture 事件解绑                                                                  |
| `intl.test.ts`      | 富文本回退误销毁父组件、语言包加载失败后的重试                                    |
| `scheduler.test.ts` | postMessage 降级调度的任务编号                                                    |

`vm.test.ts` 另保留一个 `for-of` 对照用例：验证通过迭代修改数组项能够触发通知。该场景已验证正常，不列为缺陷。

组件测试直接调用运行时渲染接口和路径绑定接口，模拟编译器生成的代码，不依赖 `jinge-compiler`。
公共 helper 在测试结束后清理组件、当前 host 和 DOM；环境能力模拟及调度器测试会恢复修改的全局属性。

当前全量结果：共 307 个测试，全部通过。数组写操作有 54 个专门的通知用例，全部通过。

`array-copy-within.test.ts` 分别验证数组/父对象/索引的通知，以及复制与覆盖后的子对象关联，现均通过。操作使用原生 copyWithin 保留重叠与孔洞语义，包装层维护目标索引的父子关系，并发送数组变更通知。

`for-direct-array.test.ts` 覆盖编译器将直接传入的 VM 数组放在普通 props 中的场景：For 为 loop 建立局部响应式容器，复用属性路径通知和合并逻辑；卸载时仅清理该容器，不销毁共享数组。3 个用例验证直接替换/追加、先改变结构再修改子属性，以及多个 For 共享数组时的独立卸载。

## 循环引用：通知路径遇环时停止

原问题 3 已按通知递归链截断处理：创建与赋值不禁止循环，通知传播在当前路径重复经过同一 ViewModel 时停止。不使用全局 visited 集合，共享对象的其他父路径仍正常通知。

此方案不展开重复绕环的别名路径，因此 `watch(state, ['self', 'n'], ...)` 不保证随 `state.n` 变化而触发。业务应直接监听环内目标对象，例如 `watch(state.self, 'n', ...)`。限制已记入项目 README，并通过 `vm/cyclic-watch.test.ts` 验证；包装、属性赋值和其他数组写操作没有增加循环校验。
