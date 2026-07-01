export function formatVnd(amount: number) { return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amount); }
export function calculateEligibleProductRevenue(items: { unitPrice: number; quantity: number; discountAmount?: number }[]) { return items.reduce((sum, item) => sum + item.unitPrice * item.quantity - (item.discountAmount ?? 0), 0); }
