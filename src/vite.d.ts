/// <reference types="vite/client" />

import type { JingeHmrRuntime } from './hmr';

declare global {
  interface Window {
    __JINGE_HMR__?: JingeHmrRuntime;
  }
}
