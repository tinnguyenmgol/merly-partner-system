export type HaravanOrder = { id: string; order_number: string; total_price: number; line_items: Array<{ sku?: string; name: string; price: number; quantity: number }> };
export type HaravanSyncResult = { ok: boolean; message: string; syncedOrders: number };
