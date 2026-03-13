import * as admin from 'firebase-admin';

const firebaseAdminConfig = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // Manejar el caso de que la clave privada tenga saltos de línea escapados
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

function assertAdminConfig() {
    if (!firebaseAdminConfig.projectId || !firebaseAdminConfig.privateKey || !firebaseAdminConfig.clientEmail) {
        throw new Error('Firebase Admin credentials are not fully configured.')
    }
}

export function getAdminApp() {
    if (admin.apps.length === 0) {
        assertAdminConfig()
        return admin.initializeApp({
            credential: admin.credential.cert(firebaseAdminConfig as any),
            storageBucket: `${firebaseAdminConfig.projectId}.firebasestorage.app`,
        });
    }
    return admin.apps[0]!;
}

function createLazyAdminAccessor<T extends object>(factory: () => T): T {
    return new Proxy({} as T, {
        get(_target, prop) {
            const instance = factory() as any
            const value = instance[prop]
            return typeof value === 'function' ? value.bind(instance) : value
        },
    })
}

export const adminDb = createLazyAdminAccessor(() => admin.firestore(getAdminApp()));
export const adminStorage = createLazyAdminAccessor(() => admin.storage(getAdminApp()));
export const adminAuth = createLazyAdminAccessor(() => admin.auth(getAdminApp()));
