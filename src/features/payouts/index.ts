import { isOrderCommissionEligible } from "@/features/commissions";
import { db } from "@/lib/db";

export const DEFAULT_MINIMUM_PAYOUT_AMOUNT = 100_000;

export type PartnerPayoutReadyBalance = {
  partnerId: string;
  partnerDisplayName: string;
  payableAmount: number;
  rolloverAmount: number;
  payoutReadyAmount: number;
  minimumPayoutAmount: number;
  payableLedgerCount: number;
};

export async function getPayoutReadyBalances(minimumPayoutAmount = DEFAULT_MINIMUM_PAYOUT_AMOUNT): Promise<PartnerPayoutReadyBalance[]> {
  const partners = await db.partner.findMany({
    include: {
      ledgerEntries: { where: { status: "payable" }, include: { order: true } },
      payouts: { where: { status: { in: ["draft", "pending"] } } },
    },
    where: { partnerType: { code: "referral_ctv", enabled: true } },
    orderBy: { displayName: "asc" },
  });

  return partners.map((partner) => {
    const eligibleLedgers = partner.ledgerEntries.filter((ledger) => !ledger.order || isOrderCommissionEligible(ledger.order));
    const payableAmount = eligibleLedgers.reduce((sum, ledger) => sum + ledger.amount, 0);
    const reservedAmount = partner.payouts.reduce((sum, payout) => sum + payout.amount, 0);
    const availableAmount = Math.max(payableAmount - reservedAmount, 0);
    const payoutReadyAmount = availableAmount >= minimumPayoutAmount ? availableAmount : 0;

    return {
      partnerId: partner.id,
      partnerDisplayName: partner.displayName,
      payableAmount: availableAmount,
      rolloverAmount: payoutReadyAmount > 0 ? 0 : availableAmount,
      payoutReadyAmount,
      minimumPayoutAmount,
      payableLedgerCount: eligibleLedgers.length,
    };
  });
}
