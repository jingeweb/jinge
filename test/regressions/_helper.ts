import { ComponentHost, destroyComponent } from '../../src';
import { setCurrentComponentHost } from '../../src/core/hook';
import { mockOffscreenCanvas } from '../vm/_helper';

const hosts = new Set<ComponentHost>();

export function trackHost(host: ComponentHost) {
  hosts.add(host);
  return host;
}

export function createHost() {
  return trackHost(new ComponentHost());
}

// Wait through the microtasks used by both VM and expression watchers.
export function flushUpdates() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

export function setupRegressionTests() {
  beforeEach(() => {
    mockOffscreenCanvas();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    try {
      hosts.forEach((host) => destroyComponent(host, false));
    } finally {
      hosts.clear();
      setCurrentComponentHost(undefined);
      document.body.innerHTML = '';
    }
  });
}
