import { HaravanClient } from "./haravan-client";import type { HaravanSyncResult } from "./types";
export async function syncHaravanOrders(_client = new HaravanClient()): Promise<HaravanSyncResult> { return { ok: false, message: "TODO: implement Haravan order sync in a later milestone", syncedOrders: 0 }; }
