"use client";

import { useActionState, useState } from "react";
import { submitPartnerRegistration, type PartnerRegistrationState } from "@/features/partners/intake";

type PartnerTypeCode = "referral_ctv" | "shop_referral" | "mini_corner" | "agency";

type Field = { name: string; label: string; required?: boolean; type?: string; textarea?: boolean };

const partnerTypes: { code: PartnerTypeCode; label: string; description: string }[] = [
  { code: "referral_ctv", label: "CTV cá nhân", description: "Phù hợp với cá nhân bán online, review, giới thiệu khách cho Merly." },
  { code: "shop_referral", label: "Shop giới thiệu khách", description: "Phù hợp với shop quần áo, shop big size, cộng đồng có tệp khách hàng phù hợp." },
  { code: "mini_corner", label: "Mini corner", description: "Phù hợp với cửa hàng muốn trưng bày một góc sản phẩm Merly." },
  { code: "agency", label: "Đại lý", description: "Phù hợp với đối tác nhập hàng bán lại hoặc phân phối." },
];

const commonContact: Field[] = [
  { name: "contactName", label: "Họ và tên người liên hệ", required: true },
  { name: "phone", label: "Số điện thoại", required: true },
  { name: "email", label: "Email", type: "email" },
  { name: "zalo", label: "Zalo" },
  { name: "cityProvince", label: "Khu vực / tỉnh thành" },
];

const bankFields: Field[] = [
  { name: "bankAccountName", label: "Chủ tài khoản ngân hàng" },
  { name: "bankName", label: "Tên ngân hàng" },
  { name: "bankAccountNumber", label: "Số tài khoản ngân hàng" },
];

const typeFields: Record<PartnerTypeCode, Field[]> = {
  referral_ctv: [
    { name: "fullName", label: "Họ và tên", required: true },
    { name: "salesChannel", label: "Kênh bán hàng" },
    { name: "socialLink", label: "Link Facebook/TikTok/Shopee/Website" },
  ],
  shop_referral: [
    { name: "shopName", label: "Tên shop", required: true },
    { name: "storeAddress", label: "Địa chỉ cửa hàng", required: true },
    { name: "salesChannel", label: "Kênh bán hàng" },
    { name: "socialLink", label: "Link Facebook/TikTok/Shopee/Website" },
    { name: "customerSegment", label: "Mô tả tệp khách hàng", textarea: true },
  ],
  mini_corner: [
    { name: "shopName", label: "Tên shop", required: true },
    { name: "storeAddress", label: "Địa chỉ cửa hàng", required: true },
    { name: "socialLink", label: "Link Facebook/TikTok/Shopee/Website" },
    { name: "customerSegment", label: "Mô tả tệp khách hàng", textarea: true },
    { name: "displayAreaNote", label: "Mô tả góc trưng bày", textarea: true },
    { name: "expectedDisplayQuantity", label: "Dự kiến số lượng trưng bày ban đầu", type: "number" },
  ],
  agency: [
    { name: "businessName", label: "Tên shop / đơn vị", required: true },
    { name: "storeAddress", label: "Địa chỉ cửa hàng hoặc kho", required: true },
    { name: "salesChannel", label: "Kênh bán hàng" },
    { name: "socialLink", label: "Link Facebook/TikTok/Shopee/Website" },
    { name: "businessModelNote", label: "Mô hình kinh doanh", textarea: true },
    { name: "expectedOpeningOrderAmount", label: "Dự kiến mức nhập ban đầu", type: "number" },
    { name: "coverageArea", label: "Khu vực phân phối" },
    { name: "taxCode", label: "Mã số thuế (nếu có)" },
  ],
};

const initialState: PartnerRegistrationState = { values: {} };

function FieldInput({ field, values, errors }: { field: Field; values: Record<string, string>; errors?: Partial<Record<string, string>> }) {
  const error = errors?.[field.name];
  return (
    <label className={`grid gap-2 text-sm ${field.textarea ? "md:col-span-2" : ""}`}>
      {field.label}{field.required ? " *" : ""}
      {field.textarea ? (
        <textarea aria-invalid={error ? "true" : undefined} className="input min-h-24" defaultValue={values[field.name] ?? ""} name={field.name} placeholder={field.label} required={field.required} />
      ) : (
        <input aria-invalid={error ? "true" : undefined} className="input" defaultValue={values[field.name] ?? ""} name={field.name} placeholder={field.label} required={field.required} type={field.type ?? "text"} />
      )}
      {error ? <span className="text-sm font-medium text-red-700">{error}</span> : null}
    </label>
  );
}

export function RegistrationForm() {
  const [state, formAction, pending] = useActionState(submitPartnerRegistration, initialState);
  const [selectedType, setSelectedType] = useState<PartnerTypeCode | "">((state.values.partnerTypeCode as PartnerTypeCode) || "");
  const contactFields = selectedType === "referral_ctv" ? commonContact.filter((field) => field.name !== "contactName") : commonContact;

  return (
    <form action={formAction} className="mt-6 grid gap-5">
      {state.message ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800" role="alert">{state.message}</div> : null}
      <section className="grid gap-3">
        <h2 className="text-lg font-bold text-merly-900">1. Chọn loại hình hợp tác</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {partnerTypes.map((type) => (
            <label className={`cursor-pointer rounded-2xl border p-4 transition ${selectedType === type.code ? "border-merly-600 bg-rose-50 shadow-sm" : "border-rose-100 bg-white"}`} key={type.code}>
              <input className="sr-only" checked={selectedType === type.code} name="partnerTypeCode" onChange={() => setSelectedType(type.code)} required type="radio" value={type.code} />
              <span className="font-bold text-merly-900">{type.label}</span>
              <span className="mt-2 block text-sm text-stone-600">{type.description}</span>
            </label>
          ))}
        </div>
        {state.fieldErrors?.partnerTypeCode ? <p className="text-sm font-medium text-red-700">{state.fieldErrors.partnerTypeCode}</p> : null}
      </section>

      {selectedType ? (
        <section className="grid gap-4 md:grid-cols-2">
          <h2 className="md:col-span-2 text-lg font-bold text-merly-900">2. Thông tin đăng ký</h2>
          {[...typeFields[selectedType], ...contactFields, ...bankFields].map((field) => <FieldInput errors={state.fieldErrors} field={field} key={`${selectedType}-${field.name}`} values={state.values} />)}
          {selectedType === "shop_referral" ? (
            <div className="grid gap-3 text-sm md:col-span-2 md:grid-cols-2">
              <label className="flex gap-3"><input defaultChecked={state.values.hasOfflineStore === "on"} name="hasOfflineStore" type="checkbox" /> Có cửa hàng offline không</label>
              <label className="flex gap-3"><input defaultChecked={state.values.hasLivestream === "on"} name="hasLivestream" type="checkbox" /> Có livestream không</label>
            </div>
          ) : null}
          <label className="grid gap-2 text-sm md:col-span-2">Kinh nghiệm / ghi chú<textarea className="input min-h-28" defaultValue={state.values.note ?? ""} name="note" /></label>
          <label className="flex gap-3 text-sm md:col-span-2"><input defaultChecked={state.values.agreePolicy === "on"} name="agreePolicy" required type="checkbox" /> Tôi đồng ý chính sách đối tác Merly và quy định xét duyệt / đối soát.</label>
          {state.fieldErrors?.agreePolicy ? <p className="text-sm font-medium text-red-700 md:col-span-2">{state.fieldErrors.agreePolicy}</p> : null}
          <button className="btn-primary md:col-span-2" disabled={pending} type="submit">{pending ? "Đang gửi..." : "Gửi đăng ký đối tác"}</button>
        </section>
      ) : (
        <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-600">Vui lòng chọn loại hình hợp tác để xem đúng bộ câu hỏi đăng ký.</p>
      )}
    </form>
  );
}
