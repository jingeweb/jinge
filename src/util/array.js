
export function arrayIndexOf(array, item) {
  return array.indexOf(item);
}

export function arrayRemove(array, item) {
  const idx = arrayIndexOf(array, item);
  if (idx < 0) return false;
  array.splice(idx, 1);
  return true;
}

export function arrayPushIfNotExist(array, item) {
  const idx = arrayIndexOf(array, item);
  if (idx >= 0) return;
  array.push(item);
}

export function arrayFind(array, predicate) {
  if (array.find) {
    return array.find(predicate);
  } else {
    const i = arrayFindIndex(array, predicate);
    return i >= 0 ? array[i] : null;
  }
}

export function arrayFindIndex(array, predicate) {
  for(let i = 0; i < array.length; i++) {
    if (predicate(array[i], i)) return i;
  }
  return -1;
}