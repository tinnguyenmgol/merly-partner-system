"use server";
import { redirect } from "next/navigation";
import { createPartnerSession, destroyPartnerSession, setPasswordWithToken } from "./partner-auth";

const LOGIN_ERROR = "Thông tin đăng nhập không đúng hoặc tài khoản chưa được kích hoạt.";
export async function loginAction(_prev: { message?: string }, formData: FormData) {
  const login = String(formData.get("login") ?? ""); const password = String(formData.get("password") ?? "");
  const account = await createPartnerSession(login, password);
  if (!account) return { message: LOGIN_ERROR };
  redirect("/dashboard");
}
export async function setupPasswordAction(_prev: { message?: string }, formData: FormData) {
  const token = String(formData.get("token") ?? ""); const password = String(formData.get("password") ?? ""); const confirm = String(formData.get("confirmPassword") ?? "");
  if (password !== confirm) return { message: "Mật khẩu xác nhận không khớp." };
  const result = await setPasswordWithToken(token, password);
  if (!result.ok) return { message: result.message };
  redirect("/dang-nhap?setup=success");
}
export async function logoutAction() { await destroyPartnerSession(); redirect("/dang-nhap"); }
