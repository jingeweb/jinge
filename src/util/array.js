
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
