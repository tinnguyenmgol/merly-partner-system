import { handleProductSync } from "@/features/haravan/admin-actions";
export async function POST(request: Request) { return handleProductSync(request); }
