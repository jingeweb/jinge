import { isObject, isString } from './type';

export function uid(): string {
  return Date.now().toString(32) + Math.floor(Math.random() * 0xffffff).toString(32);
}

export type DeregisterFn = () => Promise<void> | void;

export type ClassnameItem =
  | Record<string, string | boolean | null | undefined>
  | string
  | boolean
  | null
  | undefined;
export function classnames(...args: ClassnameItem[]) {
  const segs: string[] = [];
  args.forEach((arg) => {
    if (isString(arg)) {
      arg = arg.trim();
      if (arg) segs.push(arg);
    } else if (isObject(arg)) {
      Object.entries(arg).forEach(([k, v]) => {
        if (v) {
          k = k.trim();
          if (k) segs.push(k);
        }
      });
    }
  });
  return segs.join(' ');
}
