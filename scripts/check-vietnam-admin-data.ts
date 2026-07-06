import { vietnamAdminUnits } from "../src/data/vietnam-admin-units";

const errors: string[] = [];
const provinceCodes = new Set(vietnamAdminUnits.map((province) => province.code));
const wardMapKeys = new Set(vietnamAdminUnits.map((province) => province.code));

for (const province of vietnamAdminUnits) {
  if (province.wards.length === 0) errors.push(`${province.code} ${province.name} has no wards`);
  const wardCodes = new Set<string>();
  for (const ward of province.wards) {
    if (wardCodes.has(ward.code)) errors.push(`${province.code} ${province.name} has duplicate ward code ${ward.code}`);
    wardCodes.add(ward.code);
  }
}

const haNoi = vietnamAdminUnits.find((province) => province.code === "01");
const hcm = vietnamAdminUnits.find((province) => province.code === "79");
if (!haNoi || haNoi.wards.length <= 4) errors.push("Hà Nội must have more than 4 ward records");
if (!hcm || hcm.wards.length <= 4) errors.push("TP.HCM must have more than 4 ward records");

for (const province of vietnamAdminUnits) {
  if (!provinceCodes.has(province.code)) errors.push(`${province.name} has unknown provinceCode ${province.code}`);
}

const uiCodes = vietnamAdminUnits.map((province) => province.code).sort();
const mapCodes = [...wardMapKeys].sort();
if (JSON.stringify(uiCodes) !== JSON.stringify(mapCodes)) errors.push("Province codes used by UI do not exactly match ward map keys");

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const wardCount = vietnamAdminUnits.reduce((sum, province) => sum + province.wards.length, 0);
console.log(`Vietnam admin data OK: ${vietnamAdminUnits.length} provinces, ${wardCount} wards/communes/special zones.`);
