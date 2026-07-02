"use client";

import { useActionState } from "react";
import { sendTestEmailAction } from "@/features/email-actions";

export function TestEmailForm() {
  const [state, action, pending] = useActionState(sendTestEmailAction, {});
  return (
    <form action={action} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
      {state.message ? <p className={`md:col-span-2 rounded-xl p-3 text-sm font-medium ${state.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{state.message}</p> : null}
      <input className="input" name="to" placeholder="Email nhận thử" type="email" required />
      <button className="btn-secondary" disabled={pending}>{pending ? "Đang gửi..." : "Gửi email thử"}</button>
    </form>
  );
}
