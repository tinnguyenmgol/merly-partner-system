-- Keep manual commission recalculation idempotent: one order-backed ledger row per order.
CREATE UNIQUE INDEX "PartnerCommissionLedger_orderId_key" ON "PartnerCommissionLedger"("orderId");

-- Prevent the same payable ledger row from being reserved in multiple payout drafts.
CREATE UNIQUE INDEX "PartnerPayoutItem_ledgerId_key" ON "PartnerPayoutItem"("ledgerId");
