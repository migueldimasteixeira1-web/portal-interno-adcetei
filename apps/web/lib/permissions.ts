import type { User } from "./types";

export function hasPermission(user: User | null | undefined, permission: string): boolean {
  return Boolean(user?.permissions?.includes(permission));
}
