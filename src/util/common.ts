export function uid(): string {
  return Date.now().toString(32) + Math.floor(Math.random() * 0xffffff).toString(32);
}

export type DeregisterFn = () => Promise<void> | void;
