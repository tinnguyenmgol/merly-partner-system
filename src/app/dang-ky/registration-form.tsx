"use client";

import { useActionState } from "react";
import { submitPartnerRegistration, type PartnerRegistrationState } from "@/features/partners/intake";

const fields = [
  ["fullName", "Họ và tên", true],
  ["phone", "Số điện thoại", true],
  ["email", "Email", false],
  ["zalo", "Zalo", false],
  ["area", "Khu vực / tỉnh thành", false],
  ["sellingChannel", "Kênh bán hàng", false],
  ["socialLink", "Link Facebook/TikTok/Shopee (nếu có)", false],
  ["bankAccountHolder", "Chủ tài khoản ngân hàng", false],
  ["bankName", "Tên ngân hàng", false],
  ["bankAccountNumber", "Số tài khoản ngân hàng", false],
] as const;

const initialState: PartnerRegistrationState = { values: {} };

export function RegistrationForm() {
  const [state, formAction, pending] = useActionState(submitPartnerRegistration, initialState);

  return (
    <form action={formAction} className="mt-6 grid gap-4 md:grid-cols-2">
      {state.message && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800 md:col-span-2" role="alert">
          {state.message}
        </div>
      )}
      {fields.map(([name, label, required]) => {
        const error = state.fieldErrors?.[name];

        return (
          <label className="grid gap-2 text-sm" key={name}>
            {label}
            <input
              aria-invalid={error ? "true" : undefined}
              aria-describedby={error ? `${name}-error` : undefined}
              className="input"
              defaultValue={state.values[name] ?? ""}
              name={name}
              placeholder={label}
              required={required}
            />
            {error && (
              <span className="text-sm font-medium text-red-700" id={`${name}-error`}>
                {error}
              </span>
            )}
          </label>
        );
      })}
      <label className="grid gap-2 text-sm md:col-span-2">
        Kinh nghiệm / ghi chú
        <textarea className="input min-h-28" defaultValue={state.values.experienceNote ?? ""} name="experienceNote" />
      </label>
      <label className="flex gap-3 text-sm md:col-span-2">
        <input defaultChecked={state.values.acceptedPolicy === "on"} name="acceptedPolicy" required type="checkbox" /> Tôi đồng ý chính sách CTV Merly và quy định đối soát hoa hồng.
      </label>
      <button className="btn-primary md:col-span-2" disabled={pending} type="submit">
        {pending ? "Đang gửi..." : "Gửi đăng ký"}
      </button>
    </form>
  );
}
