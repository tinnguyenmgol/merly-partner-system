import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const partnerTypeCodes = [
  "referral_ctv",
  "mini_corner",
  "wholesale_agent",
  "shop_referral",
  "affiliate_creator",
] as const;

async function main() {
  const types = await Promise.all(
    partnerTypeCodes.map((code) =>
      prisma.partnerType.upsert({
        where: { code },
        update: {},
        create: { code, name: code, enabled: code === "referral_ctv" },
      }),
    ),
  );

  const referral = types.find((type) => type.code === "referral_ctv");

  if (!referral) {
    throw new Error("Seed failed: referral_ctv partner type was not created.");
  }

  await prisma.partnerCommissionRule.deleteMany({ where: { partnerTypeId: referral.id } });

  for (const rule of [
    { name: "Listed price no discount", minDiscountBps: 0, maxDiscountBps: 0, commissionRateBps: 1000 },
    { name: "Discount 5% to 10%", minDiscountBps: 500, maxDiscountBps: 1000, commissionRateBps: 700 },
    { name: "Unauthorized partner discount", commissionRateBps: 0, unauthorizedDiscount: true },
    { name: "Above 10% discount manual review", minDiscountBps: 1001, manualReviewRequired: true },
  ]) {
    await prisma.partnerCommissionRule.create({ data: { ...rule, partnerTypeId: referral.id } });
  }

  await prisma.partnerLevelRule.deleteMany();

  for (const [rank, name, orders] of [
    [1, "CTV mới", 0],
    [2, "CTV hoạt động", 10],
    [3, "CTV tốt", 10],
    [4, "CTV mạnh", 30],
  ] as const) {
    const level = await prisma.partnerLevel.upsert({ where: { name }, update: {}, create: { name, rank } });

    await prisma.partnerLevelRule.create({
      data: {
        levelId: level.id,
        successfulOrdersRequired: orders,
        commissionRateBps: rank > 2 ? (rank === 3 ? 1200 : 1500) : 1000,
        requiresAdminApproval: rank > 2,
      },
    });
  }

  const approved = await prisma.partner.upsert({
    where: { email: "ctv001@merly.vn" },
    update: {},
    create: {
      partnerTypeId: referral.id,
      status: "approved",
      email: "ctv001@merly.vn",
      phone: "0900000001",
      displayName: "CTV Merly 001",
      profile: {
        create: {
          fullName: "Nguyễn Merly Một",
          zalo: "0900000001",
          area: "TP.HCM",
          sellingChannel: "Facebook",
          bankAccountHolder: "NGUYEN MERLY MOT",
          bankName: "VCB",
          bankAccountNumber: "00110011",
        },
      },
    },
  });

  await prisma.partnerCode.upsert({
    where: { code: "MERLYCTV001" },
    update: {},
    create: { partnerId: approved.id, code: "MERLYCTV001" },
  });

  await prisma.partner.upsert({
    where: { email: "pending@merly.vn" },
    update: {},
    create: {
      partnerTypeId: referral.id,
      status: "pending",
      email: "pending@merly.vn",
      phone: "0900000002",
      displayName: "CTV Chờ duyệt",
      profile: { create: { fullName: "Trần Chờ Duyệt", area: "Hà Nội", sellingChannel: "TikTok" } },
    },
  });

  const order = await prisma.partnerOrder.upsert({
    where: { orderCode: "MPS-DEMO-001" },
    update: {},
    create: {
      partnerId: approved.id,
      orderCode: "MPS-DEMO-001",
      customerName: "Khách mẫu",
      status: "delivered",
      eligibleProductRevenue: 1200000,
      discountAmount: 0,
      shippingFee: 30000,
      deliveredAt: new Date(),
    },
  });

  await prisma.partnerCommissionLedger.deleteMany({
    where: { orderId: order.id, reason: "Demo listed price commission" },
  });

  await prisma.partnerCommissionLedger.create({
    data: {
      partnerId: approved.id,
      orderId: order.id,
      status: "reconciliation_waiting",
      amount: 120000,
      commissionRateBps: 1000,
      eligibleProductRevenue: 1200000,
      reason: "Demo listed price commission",
    },
  });
}

main().finally(() => prisma.$disconnect());
