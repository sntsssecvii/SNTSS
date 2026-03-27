import { Timestamp } from "firebase/firestore";

/** Convierte un Firestore Timestamp (o cualquier variante) a Date */
export function convertirTimestamp(
  timestamp: Timestamp | Date | { seconds: number } | null | undefined,
): Date {
  if (!timestamp) return new Date();
  if (timestamp instanceof Date) return timestamp;
  if (typeof (timestamp as Timestamp).toDate === "function") {
    return (timestamp as Timestamp).toDate();
  }
  return new Date();
}
