
export function arrayRemove(array: unknown[], item: unknown): boolean {
  const idx = array.indexOf(item);
  if (idx < 0) return false;
  array.splice(idx, 1);
  return true;
}

export function arrayPushIfNotExist(array: unknown[], item: unknown): void {
  const idx = array.indexOf(item);
  if (idx >= 0) return;
  array.push(item);
}


export function arrayEqual(arr1: unknown[], arr2: unknown[]): boolean {
  if (arr1.length !== arr2.length) return false;
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) return false;
  }
  return true;
}
