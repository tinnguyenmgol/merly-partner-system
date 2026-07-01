"use server";

import { revalidatePath } from "next/cache";
import { syncHaravanOrders } from "./order-sync";

export async function runHaravanOrderSync() {
  await syncHaravanOrders();
  revalidatePath("/admin/settings/haravan");
  revalidatePath("/admin/orders");
}
