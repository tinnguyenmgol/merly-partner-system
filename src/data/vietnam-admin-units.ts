export type VietnamWard = { code: string; name: string };
export type VietnamProvince = { code: string; name: string; wards: VietnamWard[] };

// Vietnam two-level administrative picker data (province/city -> ward/commune/special zone).
// Source basis: 2025-2026 Vietnam two-level structure (34 province-level units, no district level).
// This lightweight client-safe seed includes all current province/city options and representative
// ward/commune options for major registration areas; more wards can be appended without UI changes.
export const vietnamAdminUnits: VietnamProvince[] = [
  { code: "01", name: "Thành phố Hà Nội", wards: [{ code: "00001", name: "Phường Hoàn Kiếm" }, { code: "00004", name: "Phường Ba Đình" }, { code: "00007", name: "Phường Đống Đa" }, { code: "00010", name: "Phường Cầu Giấy" }] },
  { code: "04", name: "Tỉnh Cao Bằng", wards: [] },
  { code: "08", name: "Tỉnh Tuyên Quang", wards: [] },
  { code: "11", name: "Tỉnh Điện Biên", wards: [] },
  { code: "12", name: "Tỉnh Lai Châu", wards: [] },
  { code: "14", name: "Tỉnh Sơn La", wards: [] },
  { code: "15", name: "Tỉnh Lào Cai", wards: [] },
  { code: "17", name: "Tỉnh Thái Nguyên", wards: [] },
  { code: "19", name: "Tỉnh Lạng Sơn", wards: [] },
  { code: "20", name: "Tỉnh Quảng Ninh", wards: [{ code: "07000", name: "Phường Hạ Long" }, { code: "07003", name: "Phường Bãi Cháy" }] },
  { code: "22", name: "Tỉnh Bắc Ninh", wards: [] },
  { code: "24", name: "Tỉnh Phú Thọ", wards: [] },
  { code: "31", name: "Thành phố Hải Phòng", wards: [{ code: "11000", name: "Phường Hồng Bàng" }, { code: "11003", name: "Phường Lê Chân" }] },
  { code: "33", name: "Tỉnh Hưng Yên", wards: [] },
  { code: "37", name: "Tỉnh Ninh Bình", wards: [] },
  { code: "38", name: "Tỉnh Thanh Hóa", wards: [] },
  { code: "40", name: "Tỉnh Nghệ An", wards: [] },
  { code: "42", name: "Tỉnh Hà Tĩnh", wards: [] },
  { code: "44", name: "Tỉnh Quảng Trị", wards: [] },
  { code: "46", name: "Thành phố Huế", wards: [{ code: "19000", name: "Phường Thuận Hóa" }, { code: "19003", name: "Phường Phú Xuân" }] },
  { code: "48", name: "Thành phố Đà Nẵng", wards: [{ code: "20194", name: "Phường Hải Châu" }, { code: "20200", name: "Phường Sơn Trà" }, { code: "20203", name: "Phường Ngũ Hành Sơn" }] },
  { code: "51", name: "Tỉnh Quảng Ngãi", wards: [] },
  { code: "52", name: "Tỉnh Gia Lai", wards: [] },
  { code: "56", name: "Tỉnh Khánh Hòa", wards: [{ code: "22000", name: "Phường Nha Trang" }, { code: "22003", name: "Phường Cam Ranh" }] },
  { code: "66", name: "Tỉnh Đắk Lắk", wards: [] },
  { code: "68", name: "Tỉnh Lâm Đồng", wards: [{ code: "25000", name: "Phường Đà Lạt" }, { code: "25003", name: "Phường Bảo Lộc" }] },
  { code: "75", name: "Tỉnh Đồng Nai", wards: [{ code: "26000", name: "Phường Biên Hòa" }, { code: "26003", name: "Phường Long Khánh" }] },
  { code: "79", name: "Thành phố Hồ Chí Minh", wards: [{ code: "26734", name: "Phường Sài Gòn" }, { code: "26737", name: "Phường Bến Thành" }, { code: "26740", name: "Phường Chợ Lớn" }, { code: "26743", name: "Phường Thủ Đức" }] },
  { code: "80", name: "Tỉnh Tây Ninh", wards: [] },
  { code: "82", name: "Thành phố Cần Thơ", wards: [{ code: "31000", name: "Phường Ninh Kiều" }, { code: "31003", name: "Phường Cái Răng" }] },
  { code: "86", name: "Tỉnh Vĩnh Long", wards: [] },
  { code: "91", name: "Tỉnh Đồng Tháp", wards: [] },
  { code: "92", name: "Tỉnh An Giang", wards: [] },
  { code: "96", name: "Tỉnh Cà Mau", wards: [] },
];
