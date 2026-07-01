"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { PartnerStatus, Prisma } from "@prisma/client";

const REFERRAL_PARTNER_TYPE = "referral_ctv" as const;
const ADMIN_ACTOR_ID = "admin-placeholder";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(formData: FormData, key: string) {
  const value = readString(formData, key);
  return value.length > 0 ? value : undefined;
}

function normalizePartnerCode(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 24);
}

function buildDefaultPartnerCode(fullName: string, phone?: string) {
  const namePart = normalizePartnerCode(fullName).slice(0, 10) || "PARTNER";
  const phonePart = phone?.replace(/\D/g, "").slice(-4) || Date.now().toString().slice(-4);
  return `MERLY${namePart}${phonePart}`.slice(0, 24);
}

async function ensureReferralPartnerType() {
  return db.partnerType.upsert({
    where: { code: REFERRAL_PARTNER_TYPE },
    update: { enabled: true },
    create: {
      code: REFERRAL_PARTNER_TYPE,
      name: "Referral CTV",
      description: "CTV không ôm hàng; Merly xử lý hàng hóa, giao hàng và thu tiền.",
      enabled: true,
    },
  });
}

async function createUniquePartnerCode(tx: Prisma.TransactionClient, partnerId: string, requestedCode: string) {
  const base = normalizePartnerCode(requestedCode) || `MERLY${partnerId.slice(-8).toUpperCase()}`;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = attempt === 0 ? base : `${base.slice(0, 20)}${attempt}`;
    const existing = await tx.partnerCode.findUnique({ where: { code } });

    if (!existing) {
      return tx.partnerCode.create({ data: { partnerId, code } });
    }
  }

  return tx.partnerCode.create({ data: { partnerId, code: `MERLY${partnerId.slice(-10).toUpperCase()}` } });
}

export async function submitPartnerRegistration(formData: FormData) {
  const fullName = readString(formData, "fullName");
  const phone = readString(formData, "phone");
  const email = optionalString(formData, "email");
  const acceptedPolicy = formData.get("acceptedPolicy") === "on";

  if (!fullName || !phone || !acceptedPolicy) {
    redirect("/dang-ky?status=missing-required");
  }

  const partnerType = await ensureReferralPartnerType();

  await db.partner.create({
    data: {
      partnerTypeId: partnerType.id,
      status: "pending",
      email,
      phone,
      displayName: fullName,
      profile: {
        create: {
          fullName,
          zalo: optionalString(formData, "zalo"),
          area: optionalString(formData, "area"),
          sellingChannel: optionalString(formData, "sellingChannel"),
          socialLink: optionalString(formData, "socialLink"),
          experienceNote: optionalString(formData, "experienceNote"),
          bankAccountHolder: optionalString(formData, "bankAccountHolder"),
          bankName: optionalString(formData, "bankName"),
          bankAccountNumber: optionalString(formData, "bankAccountNumber"),
        },
      },
    },
  });

  redirect("/dang-ky?status=success");
}

export async function reviewPartnerRegistration(formData: FormData) {
  const partnerId = readString(formData, "partnerId");
  const decision = readString(formData, "decision") as "approve" | "reject" | "suspend";
  const note = optionalString(formData, "note");
  const requestedCode = readString(formData, "partnerCode");

  if (!partnerId || !["approve", "reject", "suspend"].includes(decision)) {
    throw new Error("Invalid partner review request.");
  }

  await db.$transaction(async (tx) => {
    const partner = await tx.partner.findUnique({ include: { profile: true, codes: true }, where: { id: partnerId } });

    if (!partner) {
      throw new Error("Partner not found.");
    }

    const nextStatus: PartnerStatus = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "suspended";
    const beforeJson = { status: partner.status, codes: partner.codes.map((code) => code.code) };

    await tx.partner.update({ where: { id: partnerId }, data: { status: nextStatus } });

    let createdCode: string | undefined;
    if (nextStatus === "approved" && partner.codes.length === 0) {
      const code = await createUniquePartnerCode(tx, partnerId, requestedCode || buildDefaultPartnerCode(partner.profile?.fullName ?? partner.displayName, partner.phone ?? undefined));
      createdCode = code.code;
    }

    await tx.adminAuditLog.create({
      data: {
        actorId: ADMIN_ACTOR_ID,
        partnerId,
        action: `partner.${decision}`,
        entityType: "Partner",
        entityId: partnerId,
        beforeJson,
        afterJson: { status: nextStatus, createdCode },
        note,
      },
    });
  });

  revalidatePath("/admin");
  revalidatePath("/admin/partners");
  revalidatePath(`/admin/partners/${partnerId}`);
}
