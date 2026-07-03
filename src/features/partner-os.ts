
export const vietnamDateTimeFormatter = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });

export function formatVietnamDateTime(date: Date) { return vietnamDateTimeFormatter.format(date); }

export function parseVietnamDatetimeLocal(value: FormDataEntryValue | null) {
  const s = String(value ?? "").trim();
  if (!s) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return undefined;
  const withoutZone = s.replace(/(?:Z|[+-]\d{2}:?\d{2})$/, "");
  return new Date(`${withoutZone.length === 16 ? `${withoutZone}:00` : withoutZone}+07:00`);
}

export function contentStatusLabel(item: { status: string; publishAt: Date; expiresAt: Date | null }, now = new Date()) {
  if (item.status === "archived") return "Đã lưu trữ";
  if (item.status === "draft") return "Nháp";
  if (item.publishAt > now) return "Sắp xuất bản";
  if (item.expiresAt && item.expiresAt <= now) return "Đã hết hạn";
  return "Đang hiệu lực";
}

export function campaignStatusLabel(item: { status: string; startAt: Date; endAt: Date | null }, now = new Date()) {
  if (item.status === "archived") return "Đã lưu trữ";
  if (item.status === "draft") return "Nháp";
  if (item.startAt > now) return "Sắp diễn ra";
  if (item.endAt && item.endAt <= now) return "Đã kết thúc";
  return "Đang chạy";
}

