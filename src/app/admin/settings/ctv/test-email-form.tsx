"use client";

import { useActionState } from "react";
import { sendTestEmailAction } from "@/features/email-actions";

export function TestEmailForm() {
  const [state, action, pending] = useActionState(sendTestEmailAction, {});

  return (
    <form action={action} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
      {state.message ? <p className={`md:col-span-3 rounded-xl p-3 text-sm font-medium ${state.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{state.message}</p> : null}
      <label className="grid gap-2 text-sm font-medium text-stone-700">
        Email nhận thử
        <input className="input" name="to" placeholder="noreply@merlyshoes.com" type="email" />
      </label>
      <fieldset className="grid gap-2 rounded-xl bg-stone-50 p-3 text-sm text-stone-700 md:col-span-3">
        <legend className="font-semibold text-stone-900">SMTP auth method test</legend>
        <label className="flex items-center gap-2"><input name="authMethod" type="radio" value="LOGIN" defaultChecked /> Force LOGIN</label>
        <label className="flex items-center gap-2"><input name="authMethod" type="radio" value="DEFAULT" /> Default auth</label>
      </fieldset>
      <button className="btn-secondary self-end" disabled={pending} name="intent" value="verify">{pending ? "Đang kiểm tra..." : "Kiểm tra SMTP verify"}</button>
      <button className="btn-primary self-end" disabled={pending} name="intent" value="send">{pending ? "Đang gửi..." : "Gửi email thử"}</button>
    </form>
  );
}
