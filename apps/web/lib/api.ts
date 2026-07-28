export { ApiError, SESSION_EXPIRED_EVENT, SESSION_MESSAGE_KEY, resetSessionExpiryGuard } from "./api/client";
export { adminApi } from "./api/admin";
export { authApi } from "./api/auth";
export { chatApi } from "./api/chat";
export { inventoryApi } from "./api/inventory";
export { remoteAccessApi } from "./api/remote-access";
export { ticketsApi } from "./api/tickets";
export { usersAssetsApi } from "./api/users-assets";

import { adminApi } from "./api/admin";
import { authApi } from "./api/auth";
import { chatApi } from "./api/chat";
import { inventoryApi } from "./api/inventory";
import { remoteAccessApi } from "./api/remote-access";
import { ticketsApi } from "./api/tickets";
import { usersAssetsApi } from "./api/users-assets";

export const api = {
  ...authApi,
  ...ticketsApi,
  ...usersAssetsApi,
  ...inventoryApi,
  ...remoteAccessApi,
  ...adminApi,
  ...chatApi,
};
export type { RemoteAccessMode, RemoteAccessSessionStatus, RemoteAccessAssetRef, RemoteAccessDevice, RemoteAccessSummary, RemoteAccessDevicePage, RemoteAccessSessionPayload, RemoteAccessSession, RemoteAccessLaunch, RemoteAccessHealth } from "./types/remote-access";
