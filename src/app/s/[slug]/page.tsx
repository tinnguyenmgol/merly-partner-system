import { redirectShortLink } from "@/features/growth/actions";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; await redirectShortLink(slug); }
