export type HaravanMoney = string | number | null | undefined;

export type HaravanDiscountCode = {
  code?: string | null;
  amount?: HaravanMoney;
  type?: string | null;
};

export type HaravanLineItem = {
  sku?: string | null;
  title?: string | null;
  name?: string | null;
  product_title?: string | null;
  quantity?: number | null;
  price?: HaravanMoney;
  line_price?: HaravanMoney;
  total_discount?: HaravanMoney;
  discount_allocations?: Array<{ amount?: HaravanMoney }>;
};

export type HaravanOrder = {
  id: string | number;
  order_number?: string | number | null;
  name?: string | null;
  order_code?: string | null;
  customer?: { first_name?: string | null; last_name?: string | null; name?: string | null } | null;
  financial_status?: string | null;
  fulfillment_status?: string | null;
  cancelled_at?: string | null;
  closed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  processed_at?: string | null;
  total_discounts?: HaravanMoney;
  total_shipping_price_set?: { shop_money?: { amount?: HaravanMoney } } | null;
  shipping_lines?: Array<{ price?: HaravanMoney }>;
  total_line_items_price?: HaravanMoney;
  line_items?: HaravanLineItem[];
  discount_codes?: HaravanDiscountCode[];
};

export type HaravanSyncResult = {
  ok: boolean;
  message: string;
  syncedOrders: number;
  attributedOrders: number;
  skippedOrders: number;
  logId?: string;
};
