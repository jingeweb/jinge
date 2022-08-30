let UID_INC = 0;
export function uid(): string {
  return (
    Date.now().toString(32) + '-' + Math.floor(Math.random() * 0xffffff).toString(32) + '-' + (UID_INC++).toString(32)
  );
}

let warning = true;
export function warn(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  warning && console.warn(...args);
}

export function disableWarning(): void {
  warning = false;
}

export type DeregisterFn = () => void;
