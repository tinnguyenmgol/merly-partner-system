"use server";

import { ATTRIBUTION_SOURCES } from "@/features/partners/attribution-sources";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, hasDatabaseUrl } from "@/lib/db";
import { Prisma, type PartnerStatus } from "@prisma/client";


const REFERRAL_PARTNER_TYPE = "referral_ctv" as const;
const PARTNER_TYPE_LABELS = {
  referral_ctv: "CTV cá nhân",
  shop_referral: "Shop giới thiệu khách",
  mini_corner: "Mini corner",
  agency: "Đại lý",
} as const;
const ADMIN_ACTOR_ID = "admin-placeholder";

type RegistrationPartnerType = keyof typeof PARTNER_TYPE_LABELS;

const REGISTRATION_PARTNER_TYPES = Object.keys(PARTNER_TYPE_LABELS) as RegistrationPartnerType[];

const DUPLICATE_PHONE_MESSAGE = "Số điện thoại này đã được đăng ký trong hệ thống đối tác Merly.";
const DUPLICATE_EMAIL_MESSAGE = "Email này đã được đăng ký trong hệ thống đối tác Merly.";
const DUPLICATE_GENERIC_MESSAGE = "Thông tin đăng ký đã tồn tại. Vui lòng kiểm tra lại số điện thoại hoặc email.";

export type PartnerRegistrationState = {
  message?: string;
  fieldErrors?: Partial<Record<string, string>>;
  values: Record<string, string>;
};

const registrationFields = [
  "partnerTypeCode",
  "fullName",
  "contactName",
  "shopName",
  "businessName",
  "phone",
  "email",
  "zalo",
  "storeAddress",
  "warehouseAddress",
  "cityProvince",
  "salesChannel",
  "socialLink",
  "customerSegment",
  "displayAreaNote",
  "expectedDisplayQuantity",
  "businessModelNote",
  "expectedOpeningOrderAmount",
  "coverageArea",
  "taxCode",
  "note",
  "bankAccountName",
  "bankName",
  "bankAccountNumber",
] as const;

function readValues(formData: FormData) {
  const values: Record<string, string> = {};

  for (const key of registrationFields) {
    values[key] = readString(formData, key);
  }

  for (const key of ["hasOfflineStore", "hasLivestream", "agreePolicy"]) {
    if (formData.get(key) === "on") values[key] = "on";
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

function optionalInt(formData: FormData, key: string) {
  const value = optionalString(formData, key);
  if (!value) return undefined;
  const parsed = Number(value.replace(/[^\d]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
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

async function ensurePartnerType(code: RegistrationPartnerType) {
  return db.partnerType.upsert({
    where: { code },
    update: { enabled: true, name: PARTNER_TYPE_LABELS[code] },
    create: {
      code,
      name: PARTNER_TYPE_LABELS[code],
      description: code === REFERRAL_PARTNER_TYPE ? "CTV không ôm hàng; Merly xử lý hàng hóa, giao hàng và thu tiền." : "Hồ sơ đối tác Merly đang chờ xét duyệt.",
      enabled: true,
    },
  });
}

function getDisplayName(typeCode: RegistrationPartnerType, values: Record<string, string>) {
  if (typeCode === "agency") return values.businessName || values.shopName || values.contactName;
  if (typeCode === "shop_referral" || typeCode === "mini_corner") return values.shopName || values.contactName;
  return values.fullName || values.contactName;
}

function validateRegistration(values: Record<string, string>) {
  const fieldErrors: Partial<Record<string, string>> = {};
  const typeCode = values.partnerTypeCode as RegistrationPartnerType;

  if (!REGISTRATION_PARTNER_TYPES.includes(typeCode)) fieldErrors.partnerTypeCode = "Vui lòng chọn loại hình hợp tác.";
  if (!values.contactName && !values.fullName) fieldErrors.contactName = "Vui lòng nhập người liên hệ.";
  if (!values.phone) fieldErrors.phone = "Vui lòng nhập số điện thoại.";
  if (!values.agreePolicy) fieldErrors.agreePolicy = "Vui lòng đồng ý chính sách đối tác.";
  if (["shop_referral", "mini_corner", "agency"].includes(typeCode) && !values.storeAddress && !values.warehouseAddress) fieldErrors.storeAddress = "Vui lòng nhập địa chỉ cửa hàng/kho.";

  return fieldErrors;
}

async function createUniquePartnerCode(tx: Prisma.TransactionClient, partnerId: string, requestedCode: string) {
  const base = normalizePartnerCode(requestedCode) || `MERLY${partnerId.slice(-8).toUpperCase()}`;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = attempt === 0 ? base : `${base.slice(0, 20)}${attempt}`;
    const existing = await tx.partnerCode.findUnique({ where: { code } });

    if (!existing) {
      return tx.partnerCode.create({ data: { partnerId, code, source: ATTRIBUTION_SOURCES.AFFILIATE_LINK, codePurpose: "affiliate_tracking" } });
    }
  }

  return tx.partnerCode.create({ data: { partnerId, code: `MERLY${partnerId.slice(-10).toUpperCase()}`, source: ATTRIBUTION_SOURCES.AFFILIATE_LINK, codePurpose: "affiliate_tracking" } });
}

export async function submitPartnerRegistration(_previousState: PartnerRegistrationState, formData: FormData): Promise<PartnerRegistrationState> {
  const values = readValues(formData);

  if (!hasDatabaseUrl()) {
    redirect("/dang-ky?status=database-missing");
  }

  const fieldErrors = validateRegistration(values);
  if (Object.keys(fieldErrors).length > 0) {
    return { message: "Vui lòng kiểm tra các thông tin bắt buộc.", fieldErrors, values };
  }

  const partnerTypeCode = values.partnerTypeCode as RegistrationPartnerType;
  const contactName = values.contactName || values.fullName;
  const phone = normalizePartnerPhone(values.phone);
  const email = normalizePartnerEmail(values.email);
  const displayName = getDisplayName(partnerTypeCode, { ...values, contactName });

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

  const partnerType = await ensurePartnerType(partnerTypeCode);

  try {
    await db.partner.create({
      data: {
        partnerTypeId: partnerType.id,
        status: "pending",
        email,
        phone,
        displayName,
        profile: {
          create: {
            fullName: contactName,
            contactName,
            shopName: optionalString(formData, "shopName"),
            businessName: optionalString(formData, "businessName"),
            storeAddress: optionalString(formData, "storeAddress"),
            warehouseAddress: optionalString(formData, "warehouseAddress"),
            zalo: optionalString(formData, "zalo"),
            area: optionalString(formData, "cityProvince"),
            cityProvince: optionalString(formData, "cityProvince"),
            sellingChannel: optionalString(formData, "salesChannel"),
            salesChannel: optionalString(formData, "salesChannel"),
            socialLink: optionalString(formData, "socialLink"),
            customerSegment: optionalString(formData, "customerSegment"),
            displayAreaNote: optionalString(formData, "displayAreaNote"),
            expectedDisplayQuantity: optionalInt(formData, "expectedDisplayQuantity"),
            businessModelNote: optionalString(formData, "businessModelNote"),
            expectedOpeningOrderAmount: optionalInt(formData, "expectedOpeningOrderAmount"),
            coverageArea: optionalString(formData, "coverageArea"),
            taxCode: optionalString(formData, "taxCode"),
            hasOfflineStore: formData.get("hasOfflineStore") === "on" ? true : undefined,
            hasLivestream: formData.get("hasLivestream") === "on" ? true : undefined,
            experienceNote: optionalString(formData, "note"),
            bankAccountHolder: optionalString(formData, "bankAccountName"),
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
    const partner = await tx.partner.findUnique({ include: { profile: true, codes: true, partnerType: true, account: true }, where: { id: partnerId } });

    if (!partner) {
      throw new Error("Partner not found.");
    }

    const nextStatus: PartnerStatus = decision === "approve" || decision === "reactivate" ? "approved" : decision === "reject" ? "rejected" : "suspended";
    const beforeJson = { status: partner.status, codes: partner.codes.map((code) => code.code) };

    await tx.partner.update({ where: { id: partnerId }, data: { status: nextStatus } });

    let createdCode: string | undefined;
    if (nextStatus === "approved" && partner.partnerType.code === REFERRAL_PARTNER_TYPE && !partner.account) {
      await tx.partnerAccount.create({ data: { partnerId, email: partner.email?.toLowerCase() ?? undefined, phone: partner.phone ?? undefined, status: "invited" } });
    }

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

export async function partnerAccountAction(formData: FormData) {
  const partnerId = readString(formData, "partnerId");
  const action = readString(formData, "accountAction") as "generate" | "disable" | "enable";
  if (!partnerId || !["generate", "disable", "enable"].includes(action)) throw new Error("Invalid partner account action.");
  let accountId = "";
  await db.$transaction(async (tx) => {
    const partner = await tx.partner.findUnique({ include: { partnerType: true, account: true }, where: { id: partnerId } });
    if (!partner || partner.partnerType.code !== "referral_ctv") throw new Error("Only referral_ctv accounts are supported.");
    const account = partner.account ?? await tx.partnerAccount.create({ data: { partnerId, email: partner.email?.toLowerCase() ?? undefined, phone: partner.phone ?? undefined, status: "invited" } });
    accountId = account.id;
    if (action === "disable") await tx.partnerAccount.update({ where: { id: account.id }, data: { status: "disabled" } });
    if (action === "enable") await tx.partnerAccount.update({ where: { id: account.id }, data: { status: account.passwordHash ? "active" : "invited" } });
    await tx.adminAuditLog.create({ data: { actorId: ADMIN_ACTOR_ID, partnerId, action: `partner_account.${action}`, entityType: "PartnerAccount", entityId: account.id, afterJson: { action }, note: "Partner login account action" } });
  });
  revalidatePath(`/admin/partners/${partnerId}`);
  if (action === "generate") {
    const { generateSetupPasswordToken } = await import("@/features/auth/partner-auth");
    const token = await generateSetupPasswordToken(accountId);
    redirect(`/admin/partners/${partnerId}?setupToken=${token}`);
  }
}
