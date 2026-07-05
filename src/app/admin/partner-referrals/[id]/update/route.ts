import { NextResponse } from "next/server";
import { requireAdminSession } from "@/features/auth/admin-auth";
import { updatePartnerReferralFromForm } from "@/features/partner-referrals/admin-update";
import { appUrl } from "@/lib/public-url";

const SUCCESS_MESSAGE = "Đã cập nhật giới thiệu partner.";
const ERROR_MESSAGE = "Không thể cập nhật. Vui lòng thử lại.";

function redirectToReferrals(message: string) {
  return NextResponse.redirect(appUrl(`/admin/partner-referrals?message=${encodeURIComponent(message)}`));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession();
    const [{ id }, formData] = await Promise.all([params, request.formData()]);
    formData.set("referralId", id);
    await updatePartnerReferralFromForm(formData, session.adminUserId);
    return redirectToReferrals(SUCCESS_MESSAGE);
  } catch (error) {
    if (typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")) throw error;
    console.warn("[partner-referral-update] failed", error);
    return redirectToReferrals(ERROR_MESSAGE);
  }
}
