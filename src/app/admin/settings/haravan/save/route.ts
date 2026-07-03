import { handleHaravanSettingsSave } from "@/features/haravan/admin-actions";
export async function POST(request: Request) { return handleHaravanSettingsSave(request); }
