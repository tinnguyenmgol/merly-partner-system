import type { HaravanOrder } from "./types";

type HaravanOrdersResponse = { orders?: HaravanOrder[] };

function normalizeShopDomain(domain?: string) {
  const value = domain?.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  return value || undefined;
}

export class HaravanClient {
  private readonly shopDomain?: string;
  private readonly accessToken?: string;

  constructor({ shopDomain = process.env.HARAVAN_SHOP_DOMAIN, accessToken = process.env.HARAVAN_ACCESS_TOKEN }: { shopDomain?: string; accessToken?: string } = {}) {
    this.shopDomain = normalizeShopDomain(shopDomain);
    this.accessToken = accessToken?.trim() || undefined;
  }

  async healthCheck() {
    if (!this.shopDomain) return { ok: false, message: "Missing HARAVAN_SHOP_DOMAIN" };
    if (!this.accessToken) return { ok: false, message: "Missing HARAVAN_ACCESS_TOKEN" };
    return { ok: true, message: "Configured" };
  }

  async listOrders({ limit = 50, sinceId }: { limit?: number; sinceId?: string } = {}) {
    const health = await this.healthCheck();
    if (!health.ok) throw new Error(health.message);

    const url = new URL(`https://${this.shopDomain}/admin/orders.json`);
    url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 250)));
    url.searchParams.set("status", "any");
    if (sinceId) url.searchParams.set("since_id", sinceId);

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Haravan-Access-Token": this.accessToken ?? "",
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      throw new Error(`Haravan orders request failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as HaravanOrdersResponse;
    return payload.orders ?? [];
  }
}
