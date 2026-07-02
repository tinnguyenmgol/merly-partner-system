import { MerlyLogo } from "@/components/merly-logo";
import { ResetPasswordForm } from "./reset-form";
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }){const { token = "" } = await searchParams;return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4"><MerlyLogo variant="auth"/><div className="card mt-8"><h1 className="text-3xl font-bold text-merly-900">Đặt lại mật khẩu</h1><ResetPasswordForm token={token}/></div></main>}
