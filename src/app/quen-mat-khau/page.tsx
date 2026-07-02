"use client";
import Link from "next/link";
import { useActionState } from "react";
import { MerlyLogo } from "@/components/merly-logo";
import { forgotPasswordAction } from "@/features/auth/actions";

export default function Page() {
  const [state, action, pending] = useActionState(forgotPasswordAction, { message: "", login: "", ok: false });
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <MerlyLogo variant="auth" />
      <div className="card mt-8">
        <h1 className="text-3xl font-bold text-merly-900">Quên mật khẩu?</h1>
        <p className="mt-2 text-stone-600">Nhập email hoặc số điện thoại CTV đã đăng ký.</p>
        <form action={action} className="mt-6 grid gap-4">
          {state.message ? <p className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">{state.message}</p> : null}
          <input className="input" name="login" placeholder="Email hoặc số điện thoại" required defaultValue={state.login ?? ""} />
          <button className="btn-primary" disabled={pending}>{pending ? "Đang gửi..." : "Gửi yêu cầu đặt lại mật khẩu"}</button>
        </form>
        <Link className="mt-4 block text-sm font-semibold text-merly-700 underline" href="/dang-nhap">Quay lại đăng nhập CTV</Link>
      </div>
    </main>
  );
}
