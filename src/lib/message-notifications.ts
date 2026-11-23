export type VipRejectionNotification = {
  type: "VIP_REQUEST_REJECTED";
  listingId: string;
  listingTitle: string;
};

const vipRejectionPrefix = "__WM_SYSTEM_NOTIFICATION_V1__:VIP_REQUEST_REJECTED:";

export function createVipRejectionMessageBody(notification: VipRejectionNotification) {
  return `${vipRejectionPrefix}${JSON.stringify(notification)}`;
}

export function readVipRejectionNotification(body: string, senderRole: string): VipRejectionNotification | null {
  if (!["ADMIN", "SUPER_ADMIN"].includes(senderRole) || !body.startsWith(vipRejectionPrefix)) return null;

  try {
    const value: unknown = JSON.parse(body.slice(vipRejectionPrefix.length));
    if (
      typeof value === "object" &&
      value !== null &&
      "type" in value &&
      value.type === "VIP_REQUEST_REJECTED" &&
      "listingId" in value &&
      typeof value.listingId === "string" &&
      "listingTitle" in value &&
      typeof value.listingTitle === "string"
    ) {
      return {
        type: "VIP_REQUEST_REJECTED",
        listingId: value.listingId,
        listingTitle: value.listingTitle
      };
    }
  } catch {
    return null;
  }

  return null;
}
