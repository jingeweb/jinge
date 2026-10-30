# 运行时缺陷复现

这些测试对应本次源码审阅发现的问题，断言的是期望的正确行为。
当前缺陷尚未修复，因此直接运行 `pnpm test` 会包含这些失败用例；没有使用 `skip` 或 `test.failing` 隐藏失败。

在 `jinge` 项目目录执行：

```sh
# 运行全部复现用例
pnpm test test/regressions --runInBand

# 单独查看列表更新问题
pnpm test test/regressions/for.test.ts --runInBand

# 运行原有测试
pnpm test test/vm --runInBand
```

| 文件                | 覆盖问题                                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `vm.test.ts`        | 索引扩展漏发 length 通知、splice 负索引与省略删除数量、fill 范围、delete 通知、循环引用、缺少 OffscreenCanvas 的环境 |
| `for.test.ts`       | 直接替换列表元素、无 key 列表追加项的索引                                                                            |
| `watch.test.ts`     | 动态路径监听卸载、销毁后重新注册、普通数组搭配响应式索引                                                             |
| `component.test.ts` | Transition 监听清理、渲染异常后的当前组件上下文                                                                      |
| `dom.test.ts`       | capture 事件解绑                                                                                                     |
| `intl.test.ts`      | 富文本回退误销毁父组件、语言包加载失败后的重试                                                                       |
| `scheduler.test.ts` | postMessage 降级调度的任务编号                                                                                       |

`vm.test.ts` 另保留一个 `for-of` 对照用例：验证通过迭代修改数组项能够触发通知。该场景已验证正常，不列为缺陷。

组件测试直接调用运行时渲染接口和路径绑定接口，模拟编译器生成的代码，不依赖 `jinge-compiler`。
公共 helper 在测试结束后清理组件、当前 host 和 DOM；环境能力模拟及调度器测试会恢复修改的全局属性。

添加时的验证结果：共 37 个测试，19 个通过、18 个失败；其中原有 18 个测试全部通过。测试目录的类型检查、lint 和格式检查通过。
