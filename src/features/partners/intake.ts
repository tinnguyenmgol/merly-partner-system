"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, hasDatabaseUrl } from "@/lib/db";
import { Prisma, type PartnerStatus } from "@prisma/client";

const REFERRAL_PARTNER_TYPE = "referral_ctv" as const;
const ADMIN_ACTOR_ID = "admin-placeholder";

const DUPLICATE_PHONE_MESSAGE = "Số điện thoại này đã được đăng ký trong hệ thống CTV Merly.";
const DUPLICATE_EMAIL_MESSAGE = "Email này đã được đăng ký trong hệ thống CTV Merly.";
const DUPLICATE_GENERIC_MESSAGE = "Thông tin đăng ký đã tồn tại. Vui lòng kiểm tra lại số điện thoại hoặc email.";

export type PartnerRegistrationState = {
  message?: string;
  fieldErrors?: Partial<Record<string, string>>;
  values: Record<string, string>;
};

function readValues(formData: FormData) {
  const values: Record<string, string> = {};

  for (const key of [
    "fullName",
    "phone",
    "email",
    "zalo",
    "area",
    "sellingChannel",
    "socialLink",
    "experienceNote",
    "bankAccountHolder",
    "bankName",
    "bankAccountNumber",
  ]) {
    values[key] = readString(formData, key);
  }

  if (formData.get("acceptedPolicy") === "on") {
    values.acceptedPolicy = "on";
  }

  return values;
}

function normalizePartnerPhone(input: string) {
  const compactPhone = input.trim().replace(/[\s.-]+/g, "");

  if (/^\+84[1-9]\d*$/.test(compactPhone)) {
    return `0${compactPhone.slice(3)}`;
  }

  if (/^84[1-9]\d*$/.test(compactPhone) && compactPhone.length >= 10 && compactPhone.length <= 11) {
    return `0${compactPhone.slice(2)}`;
  }

  return compactPhone;
}

function normalizePartnerEmail(input?: string) {
  return input?.trim().toLowerCase() || undefined;
}

function duplicateRegistrationState(message: string, field: "phone" | "email", values: Record<string, string>): PartnerRegistrationState {
  return { message, fieldErrors: { [field]: message }, values };
}

function prismaDuplicateRegistrationState(error: unknown, values: Record<string, string>): PartnerRegistrationState | undefined {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return undefined;
  }

  const target = Array.isArray(error.meta?.target) ? error.meta.target.map(String) : [];

  if (target.includes("phone")) {
    return duplicateRegistrationState(DUPLICATE_PHONE_MESSAGE, "phone", values);
  }

  if (target.includes("email")) {
    return duplicateRegistrationState(DUPLICATE_EMAIL_MESSAGE, "email", values);
  }

  return { message: DUPLICATE_GENERIC_MESSAGE, values };
}

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
      return tx.partnerCode.create({ data: { partnerId, code, source: "affiliate_link", codePurpose: "affiliate_tracking" } });
    }
  }

  return tx.partnerCode.create({ data: { partnerId, code: `MERLY${partnerId.slice(-10).toUpperCase()}`, source: "affiliate_link", codePurpose: "affiliate_tracking" } });
}

export async function submitPartnerRegistration(_previousState: PartnerRegistrationState, formData: FormData): Promise<PartnerRegistrationState> {
  const values = readValues(formData);

  if (!hasDatabaseUrl()) {
    redirect("/dang-ky?status=database-missing");
  }

  const fullName = values.fullName;
  const phone = normalizePartnerPhone(values.phone);
  const email = normalizePartnerEmail(values.email);
  const acceptedPolicy = formData.get("acceptedPolicy") === "on";

  if (!fullName || !phone || !acceptedPolicy) {
    redirect("/dang-ky?status=missing-required");
  }

  const existingPartner = await db.partner.findFirst({
    where: {
      OR: [{ phone }, ...(email ? [{ email }] : [])],
    },
    select: { email: true, phone: true },
  });

  if (existingPartner?.phone === phone) {
    return duplicateRegistrationState(DUPLICATE_PHONE_MESSAGE, "phone", values);
  }

  if (email && existingPartner?.email === email) {
    return duplicateRegistrationState(DUPLICATE_EMAIL_MESSAGE, "email", values);
  }

  const partnerType = await ensureReferralPartnerType();

  try {
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
  } catch (error) {
    const duplicateState = prismaDuplicateRegistrationState(error, values);

    if (duplicateState) {
      return duplicateState;
    }

    throw error;
  }

  redirect("/dang-ky?status=success");
}

export async function reviewPartnerRegistration(formData: FormData) {
  if (!hasDatabaseUrl()) {
    throw new Error("DATABASE_URL is required for partner review actions.");
  }

  const partnerId = readString(formData, "partnerId");
  const decision = readString(formData, "decision") as "approve" | "reject" | "suspend" | "reactivate";
  const note = optionalString(formData, "note");
  const requestedCode = readString(formData, "partnerCode");

  if (!partnerId || !["approve", "reject", "suspend", "reactivate"].includes(decision)) {
    throw new Error("Invalid partner review request.");
  }

  await db.$transaction(async (tx) => {
    const partner = await tx.partner.findUnique({ include: { profile: true, codes: true }, where: { id: partnerId } });

    if (!partner) {
      throw new Error("Partner not found.");
    }

    const nextStatus: PartnerStatus = decision === "approve" || decision === "reactivate" ? "approved" : decision === "reject" ? "rejected" : "suspended";
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
