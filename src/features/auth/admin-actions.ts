"use server";

import { redirect } from "next/navigation";
import { ADMIN_LOGIN_ERROR, createAdminSession, destroyAdminSession } from "./admin-auth";

function safeNext(value: string) {
  if (!value.startsWith("/admin") || value.startsWith("//") || value.startsWith("/admin/login")) return "/admin";
  return value;
}

export async function adminLoginAction(_prev: { message?: string }, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? "/admin"));
  const admin = await createAdminSession(email, password);
  if (!admin) return { message: ADMIN_LOGIN_ERROR };
  redirect(next);
}

export async function adminLogoutAction() {
  await destroyAdminSession();
  redirect("/admin/login");
}
