"use server";

import { requireAdminSession } from "@/features/auth/admin-auth";
import { revalidatePath } from "next/cache";
import { syncHaravanOrders } from "./order-sync";

export async function runHaravanOrderSync() {
  await requireAdminSession();
  await syncHaravanOrders();
  revalidatePath("/admin/settings/haravan");
  revalidatePath("/admin/orders");
}
