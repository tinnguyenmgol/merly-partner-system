import assert from "node:assert/strict";
import { calculateOrderDiscountBps, classifyCtvOrderForCommission, decideCommissionForOrder, getCtvMonthlyTier, isCtvOrderValidForMonthlyTier } from "../index";

const baseOrder = {
  partnerId: "partner_1",
  status: "delivered",
  eligibleProductRevenue: 1_000_000,
  discountAmount: 0,
  deliveredAt: new Date("2026-07-01T00:00:00.000Z"),
  cancelledAt: null,
  returnedAt: null,
  disputedAt: null,
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
};

function amount(rateBps: number) {
  return decideCommissionForOrder(baseOrder, new Date("2026-07-20T00:00:00.000Z"), rateBps).amount;
}

assert.equal(getCtvMonthlyTier(5), "base");
assert.equal(amount(1000), 100_000, "A. 5 valid monthly normal-price orders uses 10%");
assert.equal(getCtvMonthlyTier(10), "tier_10");
assert.equal(amount(1200), 120_000, "B. 10 valid monthly normal-price orders uses 12%");
assert.equal(getCtvMonthlyTier(30), "tier_30");
assert.equal(amount(1500), 150_000, "C. 30 valid monthly normal-price orders uses 15%");

const discountedOrder = { ...baseOrder, eligibleProductRevenue: 930_000, discountAmount: 70_000 };
assert.equal(calculateOrderDiscountBps(discountedOrder), 700);
assert.equal(classifyCtvOrderForCommission(discountedOrder).key, "merly_discount_5_to_10");
assert.equal(decideCommissionForOrder(discountedOrder, new Date("2026-07-20T00:00:00.000Z"), 600).amount, 55_800, "D. 5 valid monthly discounted orders uses 6%");
assert.equal(decideCommissionForOrder(discountedOrder, new Date("2026-07-20T00:00:00.000Z"), 700).amount, 65_100, "E. 10 valid monthly discounted orders uses 7%");
assert.equal(decideCommissionForOrder(discountedOrder, new Date("2026-07-20T00:00:00.000Z"), 800).amount, 74_400, "F. 30 valid monthly discounted orders uses 8%");

const cancelled = { ...baseOrder, status: "cancelled" };
assert.equal(decideCommissionForOrder(cancelled, new Date("2026-07-20T00:00:00.000Z"), 1000).amount, 0, "G. Cancelled order earns 0");
assert.equal(isCtvOrderValidForMonthlyTier(cancelled), false, "G. Cancelled order does not count toward tier");
const returned = { ...baseOrder, status: "refused" };
assert.equal(decideCommissionForOrder(returned, new Date("2026-07-20T00:00:00.000Z"), 1000).amount, 0, "H. Returned/refused order earns 0");
assert.equal(isCtvOrderValidForMonthlyTier(returned), false, "H. Returned/refused order does not count toward tier");
const outsidePolicy = { ...baseOrder, eligibleProductRevenue: 850_000, discountAmount: 150_000 };
assert.equal(classifyCtvOrderForCommission(outsidePolicy).key, "over_policy_or_unknown", "I. Outside-policy discount is blocked for automatic payable commission");
assert.equal(isCtvOrderValidForMonthlyTier(outsidePolicy), false, "I. Outside-policy discount does not count toward tier");

const first = decideCommissionForOrder(baseOrder, new Date("2026-07-20T00:00:00.000Z"), 1200);
const second = decideCommissionForOrder(baseOrder, new Date("2026-07-20T00:00:00.000Z"), 1200);
assert.deepEqual(second, first, "J. Recalculation decision is stable/idempotent for same order input");
console.log("CTV monthly commission policy tests passed");
