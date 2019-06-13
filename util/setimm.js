/**
 * setImmediate polyfill only for modern browsers
 * Copied from https://github.com/YuzuJS/setImmediate/blob/master/setImmediate.js
 * Simplified by Yuhang-Ge<abeyuhang@gmail.com>
 */
import {
  isUndefined,
  isFunction,
  isString
} from './type';
import {
  assert_fail,
  startsWith,
  uid
} from './common';

let nextHandle = 1; // Spec says greater than zero
let tasksByHandle;
let currentlyRunningATask = false;
let registerImmediate;

function setImmediate_fb(callback) {
  if (!isFunction(callback) || arguments.length > 1) assert_fail();
  tasksByHandle.set(nextHandle, callback);
  registerImmediate(nextHandle);
  // console.log('siiii', callback);
  return nextHandle++;
}

function clearImmediate_fb(handle) {
  tasksByHandle.delete(handle);
}

function runIfPresent(handle) {
  // From the spec: 'Wait until any invocations of this algorithm started before this one have completed.'
  // So if we're currently running a task, we'll need to delay this invocation.
  if (currentlyRunningATask) {
    // Delay by doing a setTimeout. setImmediate was tried instead, but in Firefox 7 it generated a
    // 'too much recursion' error.
    return setTimeout(runIfPresent, 0, handle);
  }
  const callback = tasksByHandle.get(handle);
  // console.log('stttt', handle, callback);

  if (!callback) return;
  currentlyRunningATask = true;
  try {
    callback();
  } finally {
    clearImmediate_fb(handle);
    currentlyRunningATask = false;
  }
}

if (isUndefined(window.setImmediate)) {
  tasksByHandle = new Map();
  const messagePrefix = 'setImmediate$' + uid() + '$';
  window.addEventListener('message', event => {
    if (event.source === window &&
      isString(event.data) &&
      startsWith(event.data, messagePrefix)) {
      runIfPresent(Number(event.data.slice(messagePrefix.length)));
    }
  }, false);

  registerImmediate = function (handle) {
    window.postMessage(messagePrefix + handle, '*');
  };
}

export const setImmediate = window.setImmediate || setImmediate_fb;
export const clearImmediate = window.clearImmediate || clearImmediate_fb;