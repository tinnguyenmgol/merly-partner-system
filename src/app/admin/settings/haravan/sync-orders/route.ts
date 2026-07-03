import { handleOrderSync } from "@/features/haravan/admin-actions";
export async function POST(request: Request) { return handleOrderSync(request); }
