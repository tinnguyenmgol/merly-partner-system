import { adminLogoutAction } from "@/features/auth/admin-actions";
export async function GET() { await adminLogoutAction(); }
export async function POST() { await adminLogoutAction(); }
