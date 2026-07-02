import Link from "next/link";

import { MerlyLogo } from "@/components/merly-logo";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-rose-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <MerlyLogo variant="public" />
        <nav className="hidden gap-5 text-sm font-medium text-stone-700 md:flex">
          <Link className="hover:text-merly-700" href="/">Trang chủ</Link>
          <Link className="hover:text-merly-700" href="/chinh-sach">Chính sách CTV</Link>
          <Link className="hover:text-merly-700" href="/faq">Cách hoạt động</Link>
        </nav>
        <div className="flex gap-2">
          <Link className="btn-secondary px-3 py-2 text-sm md:px-4" href="/dang-nhap">Đăng nhập CTV</Link>
          <Link className="btn-primary px-3 py-2 text-sm md:px-4" href="/dang-ky">Đăng ký CTV</Link>
        </div>
      </div>
    </header>
  );
}
