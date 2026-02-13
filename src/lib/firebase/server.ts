// lib/firebase/server.ts
import { app as serverApp, db as serverDb } from './server-config';

export const app = serverApp;
export const db = serverDb;
