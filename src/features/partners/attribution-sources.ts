import { OrderAttributionSource } from "@prisma/client";

export const ATTRIBUTION_SOURCES = {
  DISCOUNT_CODE: OrderAttributionSource.discount_code,
  REFERRAL_LINK: OrderAttributionSource.referral_link,
  AFFILIATE_LINK: OrderAttributionSource.affiliate_link,
  SHOP_DISCOUNT_CODE: OrderAttributionSource.shop_discount_code,
  MANUAL: OrderAttributionSource.manual,
  ORDER_REQUEST: OrderAttributionSource.order_request,
  IMPORTED: OrderAttributionSource.imported,
} as const;

export type AttributionSource =
  (typeof ATTRIBUTION_SOURCES)[keyof typeof ATTRIBUTION_SOURCES];
