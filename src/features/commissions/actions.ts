"use server";

import { revalidatePath } from "next/cache";
import { recalculateOpenCommissions } from "./index";

export async function recalculateOpenCommissionsAction() {
  const results = await recalculateOpenCommissions();
  revalidatePath("/admin/commissions");
  revalidatePath("/admin/payouts");
  console.info(`Recalculated ${results.filter((result) => result.ledger).length} commission ledgers; skipped ${results.filter((result) => result.skippedReason).length}.`);
}
