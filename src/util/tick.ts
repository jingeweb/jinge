import { setImmediate } from './setimm';

/**
 * 等待当前一轮 ViewModel 变更所触发的 DOM 更新完成。
 *
 * jinge 的视图更新会通过 setImmediate 合并到同一轮里执行，因此在修改数据后立即读取 DOM
 * 会拿到旧值。`await nextTick()` 之后再读取，即可拿到更新后的结果。
 *
 * 注意：nextTick 只等待“当前这一轮”已经排队的更新。如果某个监听回调里又修改了数据，
 * 由此引发的下一轮更新不会包含在这次 nextTick 中。
 */
export function nextTick(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
