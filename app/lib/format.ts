import type { Timestamp } from "firebase/firestore";

export const formatRecordDate = (timestamp?: Timestamp) => {
  if (!timestamp) {
    return "Just now";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp.toDate());
};
