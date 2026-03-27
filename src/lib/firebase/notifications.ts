import { db } from "./firebase-client";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  getDocs,
  writeBatch,
} from "firebase/firestore";

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "system" | "registration" | "proposal" | "success" | "warning" | "info";
  read: boolean;
  createdAt: any;
  link?: string;
}

export const createNotification = async (
  notification: Omit<Notification, "id" | "createdAt" | "read">,
) => {
  try {
    await addDoc(collection(db, "notifications"), {
      ...notification,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error creating notification:", error);
  }
};

export const markNotificationAsRead = async (notificationId: string) => {
  try {
    const docRef = doc(db, "notifications", notificationId);
    await updateDoc(docRef, { read: true });
  } catch (error) {
    console.error("Error marking notification as read:", error);
  }
};

export const markAllAsRead = async (userId: string) => {
  try {
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      where("read", "==", false),
    );
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);

    snapshot.docs.forEach((d) => {
      batch.update(d.ref, { read: true });
    });

    await batch.commit();
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
  }
};

export const listenToNotifications = (
  userId: string,
  callback: (notifications: Notification[]) => void,
) => {
  const q = query(
    collection(db, "notifications"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(50),
  );

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        }) as Notification,
    );
    callback(notifications);
  });
};
