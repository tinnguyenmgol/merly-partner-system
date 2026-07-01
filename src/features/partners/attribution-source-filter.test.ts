import assert from "node:assert/strict";
import { OrderAttributionSource } from "@prisma/client";
import { parseAttributionSourceFilter } from "./attribution-source-filter";

assert.deepEqual(parseAttributionSourceFilter("none"), { kind: "unattributed" });
assert.deepEqual(parseAttributionSourceFilter("unattributed"), { kind: "unattributed" });
assert.deepEqual(parseAttributionSourceFilter("affiliate_link"), {
  kind: "source",
  source: OrderAttributionSource.affiliate_link,
});
assert.deepEqual(parseAttributionSourceFilter("bad-value"), { kind: "all" });
assert.deepEqual(parseAttributionSourceFilter(undefined), { kind: "all" });
