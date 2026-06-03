import { format } from './a';
export function shout(x: number): string { return format(x, 'en-US').toUpperCase(); }
