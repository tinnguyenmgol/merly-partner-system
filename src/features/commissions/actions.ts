"use server";

import { requireAdminSession } from "@/features/auth/admin-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createPartnerStatementToken, recalculateOpenCommissions } from "./index";

export async function recalculateOpenCommissionsAction() {
  await requireAdminSession();
  const results = await recalculateOpenCommissions();
  revalidatePath("/admin/commissions");
  revalidatePath("/admin/payouts");
  console.info(`Recalculated ${results.filter((result) => result.ledger).length} commission ledgers; skipped ${results.filter((result) => result.skippedReason).length}.`);
}

export async function createPartnerStatementTokenAction(formData: FormData) {
  await requireAdminSession();
  const partnerId = String(formData.get("partnerId") ?? "");
  if (!partnerId) throw new Error("Missing partnerId");
  const token = await createPartnerStatementToken(partnerId);
  revalidatePath(`/admin/partners/${partnerId}`);
  redirect(`/admin/partners/${partnerId}?statementToken=${token}`);
}
