import { normalizeOrderCode, orderCodeVariants } from "./order-code";
import type { HaravanOrder, HaravanProduct } from "./types";

type HaravanOrdersResponse = { orders?: HaravanOrder[] };
type HaravanProductsResponse = { products?: HaravanProduct[] };

const DEFAULT_HARAVAN_API_BASE_URL = "https://apis.haravan.com";
const ORDERS_ENDPOINT_PATH = "/com/orders.json";
const PRODUCTS_ENDPOINT_PATH = "/com/products.json";

function normalizeApiBaseUrl(baseUrl?: string) {
  const value = baseUrl?.trim() || DEFAULT_HARAVAN_API_BASE_URL;
  return value.replace(/\/$/, "");
}

function responseBodyExcerpt(body: string) {
  return body.replace(/\s+/g, " ").trim().slice(0, 500) || "<empty response body>";
}

function buildHaravanErrorMessage({ status, statusText, baseUrl, body }: { status: number; statusText: string; baseUrl: string; body: string }) {
  const details = `Haravan orders request failed: ${status} ${statusText}; baseUrl=${baseUrl}; path=${ORDERS_ENDPOINT_PATH}; body=${responseBodyExcerpt(body)}`;

  if (status === 401 || status === 403) {
    return `${details}. Token Haravan không hợp lệ hoặc thiếu scope com.read_orders. Vui lòng kiểm tra HARAVAN_ACCESS_TOKEN và quyền com.read_orders.`;
  }

  if (status === 404) {
    return `${details}. Endpoint hoặc HARAVAN_API_BASE_URL có thể đang sai. Đơn hàng phải gọi ${DEFAULT_HARAVAN_API_BASE_URL}${ORDERS_ENDPOINT_PATH}.`;
  }

  return details;
}

export class HaravanClient {
  private readonly apiBaseUrl: string;
  private readonly accessToken?: string;

  constructor({ apiBaseUrl = process.env.HARAVAN_API_BASE_URL, accessToken = process.env.HARAVAN_ACCESS_TOKEN }: { apiBaseUrl?: string; accessToken?: string } = {}) {
    this.apiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
    this.accessToken = accessToken?.trim() || undefined;
  }

  async healthCheck() {
    if (!this.accessToken) return { ok: false, message: "Missing HARAVAN_ACCESS_TOKEN" };
    return { ok: true, message: "Configured" };
  }

  async listOrders({ limit = 50, page, updatedAtMin, sinceId, order = "updated_at desc", query }: { limit?: number; page?: number; updatedAtMin?: Date | string; sinceId?: string | number; order?: string; query?: Record<string, string | number | undefined> } = {}) {
    const health = await this.healthCheck();
    if (!health.ok) throw new Error(health.message);

    const url = new URL(`${this.apiBaseUrl}${ORDERS_ENDPOINT_PATH}`);
    url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 250)));
    if (page) url.searchParams.set("page", String(page));
    if (updatedAtMin) url.searchParams.set("updated_at_min", updatedAtMin instanceof Date ? updatedAtMin.toISOString() : updatedAtMin);
    if (sinceId) url.searchParams.set("since_id", String(sinceId));
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }
    url.searchParams.set("order", order);

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(buildHaravanErrorMessage({ status: response.status, statusText: response.statusText, baseUrl: this.apiBaseUrl, body }));
    }

    const payload = (await response.json()) as HaravanOrdersResponse;
    return payload.orders ?? [];
  }

  async listProducts({ limit = 50, page }: { limit?: number; page?: number } = {}) {
    const health = await this.healthCheck();
    if (!health.ok) throw new Error(health.message);

    const url = new URL(`${this.apiBaseUrl}${PRODUCTS_ENDPOINT_PATH}`);
    url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 250)));
    if (page) url.searchParams.set("page", String(page));

    const response = await fetch(url, {
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${this.accessToken}` },
      next: { revalidate: 0 },
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Haravan products request failed: ${response.status} ${response.statusText}; baseUrl=${this.apiBaseUrl}; path=${PRODUCTS_ENDPOINT_PATH}; body=${responseBodyExcerpt(body)}`);
    }
    const payload = (await response.json()) as HaravanProductsResponse;
    return payload.products ?? [];
  }

  async findOrderByCode(orderCode: string) {
    const normalized = normalizeOrderCode(orderCode);
    if (!normalized) return null;

    const variants = orderCodeVariants(normalized);
    const batches = await Promise.all([
      this.listOrders({ limit: 10, query: { name: `#${normalized}` } }),
      this.listOrders({ limit: 10, query: { order_number: normalized } }),
      this.listOrders({ limit: 10, query: { query: normalized } }),
    ]);

    return batches
      .flat()
      .find((order) => {
        const candidates = [order.order_code, order.name, order.order_number, order.id].map((value) => normalizeOrderCode(value));
        return candidates.some((candidate) => variants.map(normalizeOrderCode).includes(candidate));
      }) ?? null;
  }
}

