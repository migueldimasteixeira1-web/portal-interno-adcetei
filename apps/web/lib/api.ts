export { ApiError, SESSION_EXPIRED_EVENT, SESSION_MESSAGE_KEY, resetSessionExpiryGuard } from "./api/client";
export { adminApi } from "./api/admin";
export { authApi } from "./api/auth";
export { inventoryApi } from "./api/inventory";
export { ticketsApi } from "./api/tickets";
export { usersAssetsApi } from "./api/users-assets";

import { adminApi } from "./api/admin";
import { authApi } from "./api/auth";
import { inventoryApi } from "./api/inventory";
import { ticketsApi } from "./api/tickets";
import { usersAssetsApi } from "./api/users-assets";

export const api = {
  ...authApi,
  ...ticketsApi,
  ...usersAssetsApi,
  ...inventoryApi,
  ...adminApi,
};
