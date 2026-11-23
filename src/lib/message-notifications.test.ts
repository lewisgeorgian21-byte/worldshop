import assert from "node:assert/strict";
import test from "node:test";
import { createVipRejectionMessageBody, readVipRejectionNotification } from "./message-notifications";

test("VIP rejection notifications retain listing details and only decode for administrators", () => {
  const notification = {
    type: "VIP_REQUEST_REJECTED" as const,
    listingId: "listing-123",
    listingTitle: "Vintage camera"
  };
  const body = createVipRejectionMessageBody(notification);

  assert.deepEqual(readVipRejectionNotification(body, "ADMIN"), notification);
  assert.deepEqual(readVipRejectionNotification(body, "SUPER_ADMIN"), notification);
  assert.equal(readVipRejectionNotification(body, "USER"), null);
});

test("malformed system notification bodies do not decode as notifications", () => {
  const body = createVipRejectionMessageBody({
    type: "VIP_REQUEST_REJECTED",
    listingId: "listing-123",
    listingTitle: "Vintage camera"
  });

  assert.equal(readVipRejectionNotification(body.slice(0, -1), "ADMIN"), null);
  assert.equal(readVipRejectionNotification("Ordinary message", "ADMIN"), null);
});
