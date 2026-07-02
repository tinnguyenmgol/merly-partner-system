"use client";

import { useActionState } from "react";
import { sendTestEmailAction } from "@/features/email-actions";

export function TestEmailForm() {
  const [state, action, pending] = useActionState(sendTestEmailAction, {});

  return (
    <form action={action} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
      <div className="md:col-span-3 rounded-xl bg-sky-50 p-3 text-sm font-medium text-sky-800">
        SMTP success chỉ xác nhận máy chủ mail đã nhận thư, không đảm bảo thư vào Inbox. Hãy kiểm tra Spam/Junk/Promotions và test sang Gmail ngoài.
      </div>
      {state.message ? (
        <div className={`md:col-span-3 rounded-xl p-3 text-sm font-medium ${state.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          <p>{state.message}</p>
          {state.ok ? (
            <dl className="mt-2 grid gap-1 font-mono text-xs">
              {state.messageId ? <div><dt className="inline font-semibold">Message ID: </dt><dd className="inline">{state.messageId}</dd></div> : null}
              {typeof state.acceptedCount === "number" ? <div><dt className="inline font-semibold">Accepted: </dt><dd className="inline">{state.acceptedCount}</dd></div> : null}
              {typeof state.rejectedCount === "number" ? <div><dt className="inline font-semibold">Rejected: </dt><dd className="inline">{state.rejectedCount}</dd></div> : null}
              {state.providerResponse ? <div><dt className="inline font-semibold">Provider response: </dt><dd className="inline">{state.providerResponse}</dd></div> : null}
            </dl>
          ) : null}
          {state.selfSendWarning ? <p className="mt-2 rounded-lg bg-amber-50 p-2 text-amber-800">{state.selfSendWarning}</p> : null}
        </div>
      ) : null}
      <label className="grid gap-2 text-sm font-medium text-stone-700">
        Email nhận thử
        <input className="input" name="to" placeholder="noreply@merlyshoes.com" type="email" defaultValue={state.to ?? ""} />
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
