import { redirect } from "next/navigation";

import { adminLogoutAction } from "@/features/auth/admin-actions";

export async function GET() {
  redirect("/admin");
}

export async function POST() {
  await adminLogoutAction();
}
