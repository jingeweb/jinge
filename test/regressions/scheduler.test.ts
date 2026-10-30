const jestApi = (import.meta as ImportMeta & { jest: typeof jest }).jest;

test('postMessage scheduler fallback should dispatch the stored task handle', async () => {
  const descriptors = Object.getOwnPropertyDescriptors(window);
  const messages: string[] = [];
  const callback = jestApi.fn();
  const events = jestApi.spyOn(window, 'addEventListener');
  const post = jestApi.spyOn(window, 'postMessage').mockImplementation((message: unknown) => {
    messages.push(String(message));
  });
  try {
    Object.defineProperty(window, 'setImmediate', {
      configurable: true,
      value: undefined,
      writable: true,
    });
    Object.defineProperty(window, 'queueMicrotask', {
      configurable: true,
      value: undefined,
      writable: true,
    });
    await jestApi.isolateModulesAsync(async () => {
      const scheduler = await import('../../src/util/setimm');
      scheduler.setImmediate(callback);
      window.dispatchEvent(new MessageEvent('message', { source: window, data: messages[0] }));
      expect(callback).toHaveBeenCalledTimes(1);
    });
  } finally {
    for (const [event, listener, options] of events.mock.calls) {
      if (event === 'message') window.removeEventListener(event, listener, options);
    }
    events.mockRestore();
    post.mockRestore();
    for (const name of ['setImmediate', 'clearImmediate', 'queueMicrotask']) {
      if (descriptors[name]) Object.defineProperty(window, name, descriptors[name]);
      else Reflect.deleteProperty(window, name);
    }
  }
});
