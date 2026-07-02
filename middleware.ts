import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/admin-cookie";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!pathname.startsWith("/admin") || pathname === "/admin/login") return NextResponse.next();
  if (request.cookies.get(ADMIN_COOKIE_NAME)?.value) return NextResponse.next();
  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = { matcher: ["/admin/:path*"] };
