import { MerlyLogo } from "@/components/merly-logo";
import { RegistrationForm } from "./registration-form";


export default async function Register({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <MerlyLogo variant="auth" />
      <div className="card mt-8">
        <h1 className="text-3xl font-bold text-merly-900">Đăng ký CTV Merly</h1>
        <p className="mt-2 text-stone-600">
          Gửi hồ sơ đối tác referral_ctv. Admin Merly sẽ xét duyệt, tạo mã giới thiệu và kích hoạt tài khoản sau khi hồ sơ hợp lệ.
        </p>
        {status === "success" && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
            Merly đã nhận đăng ký của bạn. Hồ sơ đang ở trạng thái chờ duyệt.
          </div>
        )}
        {status === "missing-required" && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
            Vui lòng nhập họ tên, số điện thoại và đồng ý chính sách trước khi gửi.
          </div>
        )}
        {status === "database-missing" && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
            Chưa cấu hình DATABASE_URL nên Merly chưa thể nhận đăng ký CTV.
          </div>
        )}
        <RegistrationForm />
      </div>
    </main>
  );
}
