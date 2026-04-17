import { auth, db } from "./firebase-client";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  serverTimestamp,
  orderBy,
} from "firebase/firestore";

// Definir una interfaz base para los datos del usuario
export interface BaseUserData {
  email: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno?: string | null;
  role:
    | "SUPER_ADMIN"
    | "ADMIN"
    | "REVISOR"
    | "CAPTURISTA"
    | "CONSULTA"
    | "BOLSA"
    | "user"
    | "admin"
    | "ADMIN"
    | "USER";
  status: "pending" | "active" | "rejected";
  matricula: string;
  curp?: string;
  isDeveloper?: boolean;
}

export interface UserData extends BaseUserData {
  createdAt?: any;
  updatedAt?: any;
}

export const getCurrentUserData = async (): Promise<UserData | null> => {
  if (!auth.currentUser) {
    return null;
  }

  try {
    const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));

    if (!userDoc.exists()) {
      return null;
    }

    return userDoc.data() as UserData;
  } catch (error) {
    console.error("Error obteniendo datos del usuario:", error);
    return null;
  }
};

export const getPendingUsers = async (): Promise<
  (UserData & { id: string })[]
> => {
  try {
    const q = query(collection(db, "users"), where("status", "==", "pending"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      ...(doc.data() as UserData),
      id: doc.id,
    }));
  } catch (error) {
    console.error("Error obteniendo usuarios pendientes:", error);
    return [];
  }
};

export const getUsersByStatus = async (
  status: "active" | "pending" | "rejected",
): Promise<(UserData & { id: string })[]> => {
  try {
    const q = query(
      collection(db, "users"),
      where("status", "==", status),
      orderBy("createdAt", "desc"),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      ...(doc.data() as UserData),
      id: doc.id,
    }));
  } catch (error) {
    console.error(`Error obteniendo usuarios con estatus ${status}:`, error);
    // Si falla por falta de índice, intentamos sin el orderBy
    const qBasic = query(
      collection(db, "users"),
      where("status", "==", status),
    );
    const snapshotBasic = await getDocs(qBasic);
    return snapshotBasic.docs.map((doc) => ({
      ...(doc.data() as UserData),
      id: doc.id,
    }));
  }
};

export const updateUserStatus = async (
  userId: string,
  status: "active" | "rejected",
): Promise<boolean> => {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      status,
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error("Error actualizando estatus de usuario:", error);
    return false;
  }
};

export const getAdmins = async (): Promise<(UserData & { id: string })[]> => {
  try {
    const q = query(collection(db, "users"), where("role", "==", "ADMIN"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      ...(doc.data() as UserData),
      id: doc.id,
    }));
  } catch (error) {
    console.error("Error obteniendo administradores:", error);
    return [];
  }
};
