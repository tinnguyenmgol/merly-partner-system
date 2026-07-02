"use client";
import { useActionState } from "react";
import { adminLoginAction } from "@/features/auth/admin-actions";

export function AdminLoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(adminLoginAction, { message: "" });
  return <form action={action} className="mt-6 grid gap-4"><input type="hidden" name="next" value={next}/>{state.message ? <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{state.message}</p> : null}<label className="grid gap-1 text-sm font-medium">Email<input className="input" name="email" type="email" autoComplete="email" required/></label><label className="grid gap-1 text-sm font-medium">Mật khẩu<input className="input" name="password" type="password" autoComplete="current-password" required/></label><button className="btn-primary" disabled={pending}>{pending ? "Đang đăng nhập..." : "Đăng nhập"}</button></form>;
}
