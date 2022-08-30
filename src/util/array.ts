export function arrayRemove<T = unknown>(array: T[], item: T): boolean {
  const idx = array.indexOf(item);
  if (idx < 0) return false;
  array.splice(idx, 1);
  return true;
}

export function arrayPushIfNotExist<T = unknown>(array: T[], item: T): void {
  const idx = array.indexOf(item);
  if (idx >= 0) return;
  array.push(item);
}

export function arrayEqual<T = unknown>(arr1: T[], arr2: T[]): boolean {
  if (arr1.length !== arr2.length) return false;
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) return false;
  }
  return true;
}
