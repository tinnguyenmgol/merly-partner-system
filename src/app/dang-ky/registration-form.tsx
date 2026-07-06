"use client";

import { useActionState, useMemo, useState } from "react";
import { submitPartnerRegistration, type PartnerRegistrationState } from "@/features/partners/intake";
import { vietnamAdminUnits } from "@/data/vietnam-admin-units";

type PartnerTypeCode = "referral_ctv" | "shop_referral" | "mini_corner" | "agency";
type Field = { name: string; label: string; required?: boolean; type?: string; textarea?: boolean };

const partnerTypes: { code: PartnerTypeCode; label: string; description: string }[] = [
  { code: "referral_ctv", label: "CTV cá nhân", description: "Cá nhân bán online, review, giới thiệu khách cho Merly." },
  { code: "shop_referral", label: "Shop giới thiệu khách", description: "Shop có tệp khách phù hợp và muốn giới thiệu khách cho Merly." },
  { code: "mini_corner", label: "Mini corner", description: "Cửa hàng muốn trưng bày một góc sản phẩm Merly." },
  { code: "agency", label: "Đại lý", description: "Đối tác nhập hàng bán lại hoặc phân phối." },
];

const salesChannels = [
  ["facebook_personal", "Facebook cá nhân", "Link Facebook cá nhân"], ["facebook_page", "Facebook Page", "Link Facebook Page"], ["facebook_group", "Facebook Group", "Link Facebook Group"], ["tiktok_personal", "TikTok cá nhân", "Link TikTok cá nhân"], ["tiktok_shop", "TikTok Shop", "Link TikTok Shop"], ["shopee", "Shopee", "Link gian hàng Shopee"], ["lazada", "Lazada", "Link gian hàng Lazada"], ["website", "Website", "Link website"], ["zalo", "Zalo OA / Zalo cá nhân", "Link Zalo hoặc ghi chú"], ["offline_store", "Cửa hàng offline", "Địa chỉ cửa hàng / ghi chú"], ["livestream", "Livestream", "Link/ghi chú lịch livestream"], ["other", "Khác", "Ghi rõ kênh bán hàng"],
] as const;

const initialState: PartnerRegistrationState = { values: {} };
const baseFields: Field[] = [
  { name: "contactName", label: "Họ và tên người liên hệ", required: true }, { name: "phone", label: "Số điện thoại", required: true }, { name: "email", label: "Email", type: "email" }, { name: "zalo", label: "Zalo" },
];
const typeFields: Record<PartnerTypeCode, Field[]> = {
  referral_ctv: [{ name: "fullName", label: "Họ và tên", required: true }],
  shop_referral: [{ name: "shopName", label: "Tên shop", required: true }, { name: "storeAddress", label: "Địa chỉ cửa hàng", required: true }, { name: "customerSegment", label: "Mô tả tệp khách hàng", textarea: true }],
  mini_corner: [{ name: "shopName", label: "Tên shop", required: true }, { name: "storeAddress", label: "Địa chỉ cửa hàng", required: true }, { name: "customerSegment", label: "Mô tả tệp khách hàng", textarea: true }, { name: "displayAreaNote", label: "Mô tả góc trưng bày", textarea: true }, { name: "expectedDisplayQuantity", label: "Dự kiến số lượng trưng bày ban đầu", type: "number" }],
  agency: [{ name: "businessName", label: "Tên shop / đơn vị", required: true }, { name: "storeAddress", label: "Địa chỉ cửa hàng hoặc kho", required: true }, { name: "businessModelNote", label: "Mô hình kinh doanh", textarea: true }, { name: "expectedOpeningOrderAmount", label: "Dự kiến mức nhập ban đầu", type: "number" }, { name: "coverageArea", label: "Khu vực phân phối" }],
};

function FieldInput({ field, values, errors }: { field: Field; values: Record<string, string>; errors?: Partial<Record<string, string>> }) {
  const error = errors?.[field.name];
  return <label className={`grid gap-2 text-sm ${field.textarea ? "md:col-span-2" : ""}`}><span>{field.label}{field.required ? " *" : ""}</span>{field.textarea ? <textarea aria-invalid={error ? "true" : undefined} className="input min-h-24" defaultValue={values[field.name] ?? ""} name={field.name} required={field.required} /> : <input aria-invalid={error ? "true" : undefined} className="input" defaultValue={values[field.name] ?? ""} name={field.name} required={field.required} type={field.type ?? "text"} />}{error ? <span className="text-sm font-medium text-red-700">{error}</span> : null}</label>;
}

export function RegistrationForm({ partnerRef }: { partnerRef?: string }) {
  const [state, formAction, pending] = useActionState(submitPartnerRegistration, initialState);
  const [selectedType, setSelectedType] = useState<PartnerTypeCode | "">((state.values.partnerTypeCode as PartnerTypeCode) || "");
  const [provinceCode, setProvinceCode] = useState(state.values.provinceCode ?? "");
  const [checked, setChecked] = useState<Set<string>>(() => new Set(salesChannels.map(([code]) => state.values[`salesChannel_${code}`] === "on" ? code : "").filter(Boolean)));
  const province = useMemo(() => vietnamAdminUnits.find((item) => item.code === provinceCode), [provinceCode]);
  const contactFields = selectedType === "referral_ctv" ? baseFields.filter((field) => field.name !== "contactName") : baseFields;

  return <form action={formAction} className="mt-6 grid gap-6">
    {partnerRef ? <input type="hidden" name="partnerRef" value={partnerRef} /> : null}
    {partnerRef ? <p className="rounded-xl bg-rose-50 p-3 text-sm text-merly-900">Đăng ký qua link giới thiệu partner Merly.</p> : null}
    {state.message ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800" role="alert">{state.message}</div> : null}

    <section className="grid gap-3"><h2 className="text-lg font-bold text-merly-900">1. Loại đối tác</h2><div className="grid gap-3 md:grid-cols-2">{partnerTypes.map((type) => <label className={`cursor-pointer rounded-2xl border p-4 transition ${selectedType === type.code ? "border-merly-600 bg-rose-50 shadow-sm" : "border-rose-100 bg-white"}`} key={type.code}><input className="sr-only" checked={selectedType === type.code} name="partnerTypeCode" onChange={() => setSelectedType(type.code)} required type="radio" value={type.code} /><span className="font-bold text-merly-900">{type.label}</span><span className="mt-2 block text-sm text-stone-600">{type.description}</span></label>)}</div>{state.fieldErrors?.partnerTypeCode ? <p className="text-sm font-medium text-red-700">{state.fieldErrors.partnerTypeCode}</p> : null}</section>

    {selectedType ? <>
      <section className="grid gap-4 md:grid-cols-2"><h2 className="md:col-span-2 text-lg font-bold text-merly-900">2. Thông tin liên hệ</h2>{[...typeFields[selectedType], ...contactFields].map((field) => <FieldInput errors={state.fieldErrors} field={field} key={`${selectedType}-${field.name}`} values={state.values} />)}</section>
      <section className="grid gap-4 md:grid-cols-2"><h2 className="md:col-span-2 text-lg font-bold text-merly-900">3. Khu vực hoạt động</h2><label className="grid gap-2 text-sm">Tỉnh/Thành phố *<select className="input" name="provinceCode" required value={provinceCode} onChange={(event) => setProvinceCode(event.target.value)}><option value="">Chọn tỉnh/thành phố</option>{vietnamAdminUnits.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label><input type="hidden" name="provinceName" value={province?.name ?? ""} /><label className="grid gap-2 text-sm">Xã/Phường/Đặc khu{province?.wards.length ? " *" : ""}<select className="input" name="wardCode" required={Boolean(province?.wards.length)} defaultValue={state.values.wardCode ?? ""}><option value="">{province?.wards.length ? "Chọn xã/phường/đặc khu" : "Chưa có danh sách phường/xã cho tỉnh này"}</option>{province?.wards.map((ward) => <option key={ward.code} value={ward.code}>{ward.name}</option>)}</select></label>{state.fieldErrors?.provinceCode ? <p className="text-sm font-medium text-red-700 md:col-span-2">{state.fieldErrors.provinceCode}</p> : null}</section>
      <section className="grid gap-4"><h2 className="text-lg font-bold text-merly-900">4. Kênh bán hàng</h2>{state.fieldErrors?.salesChannels ? <p className="text-sm font-medium text-red-700">{state.fieldErrors.salesChannels}</p> : null}<div className="grid gap-3 md:grid-cols-2">{salesChannels.map(([code, label, placeholder]) => { const isChecked = checked.has(code); return <div className="rounded-2xl border border-rose-100 bg-white p-4" key={code}><label className="flex items-center gap-3 text-sm font-semibold text-merly-900"><input name={`salesChannel_${code}`} defaultChecked={isChecked} onChange={(event) => setChecked((prev) => { const next = new Set(prev); if (event.target.checked) next.add(code); else next.delete(code); return next; })} type="checkbox" />{label}</label>{isChecked ? <div className="mt-3 grid gap-2"><input type="hidden" name="salesChannelCodes" value={code} /><input type="hidden" name={`salesChannelLabel_${code}`} value={label} /><input className="input" defaultValue={state.values[`salesChannelUrl_${code}`] ?? ""} name={`salesChannelUrl_${code}`} placeholder={placeholder.startsWith("Link") ? placeholder : "Link (nếu có)"} /><input className="input" defaultValue={state.values[`salesChannelNote_${code}`] ?? ""} name={`salesChannelNote_${code}`} placeholder={placeholder} />{state.fieldErrors?.[`salesChannelUrl_${code}`] ? <span className="text-sm font-medium text-red-700">{state.fieldErrors[`salesChannelUrl_${code}`]}</span> : null}</div> : null}</div>; })}</div></section>
      <section className="grid gap-4 md:grid-cols-2"><h2 className="md:col-span-2 text-lg font-bold text-merly-900">5. Thông tin thuế</h2><FieldInput errors={state.fieldErrors} field={{ name: "taxCode", label: "Mã số thuế / CCCD đăng ký kinh doanh", required: true }} values={state.values} /></section>
      <section className="grid gap-4 md:grid-cols-2"><h2 className="md:col-span-2 text-lg font-bold text-merly-900">6. Ghi chú thêm</h2><label className="grid gap-2 text-sm md:col-span-2">Kinh nghiệm / ghi chú<textarea className="input min-h-28" defaultValue={state.values.note ?? ""} name="note" /></label><label className="flex gap-3 text-sm md:col-span-2"><input defaultChecked={state.values.agreePolicy === "on"} name="agreePolicy" required type="checkbox" /> Tôi đồng ý chính sách đối tác Merly và quy định xét duyệt / đối soát.</label>{state.fieldErrors?.agreePolicy ? <p className="text-sm font-medium text-red-700 md:col-span-2">{state.fieldErrors.agreePolicy}</p> : null}<button className="btn-primary md:col-span-2" disabled={pending} type="submit">{pending ? "Đang gửi..." : "Gửi đăng ký đối tác"}</button></section>
    </> : <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-600">Vui lòng chọn loại hình hợp tác để xem đúng bộ câu hỏi đăng ký.</p>}
  </form>;
}
