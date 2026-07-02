import { MerlyLogo } from "@/components/merly-logo";
import { AdminLoginForm } from "./login-form";

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4"><MerlyLogo variant="auth" withText href="/admin/login"/><div className="card mt-8"><h1 className="text-3xl font-bold text-merly-900">Đăng nhập quản trị Merly Partner</h1><p className="mt-2 text-stone-600">Vui lòng đăng nhập bằng tài khoản quản trị.</p><AdminLoginForm next={sp.next ?? "/admin"}/></div></main>;
}
