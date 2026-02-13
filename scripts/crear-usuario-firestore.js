/**
 * Script para crear el documento de usuario en Firestore
 * 
 * USO:
 * 1. Primero habilita Firestore en Firebase Console
 * 2. Luego ejecuta: node scripts/crear-usuario-firestore.js
 */

const https = require('https');

// Configuración
const PROJECT_ID = 'sntss-e2117';
const USER_EMAIL = 'gerardoyx@hotmail.com';
const USER_PASSWORD = '123456';
const API_KEY = 'AIzaSyAoGMgaouxlJgO6ZtDcN5xENh4jA6DZv90';

// Paso 1: Autenticar usuario
function authenticateUser() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      email: USER_EMAIL,
      password: USER_PASSWORD,
      returnSecureToken: true
    });

    const options = {
      hostname: 'identitytoolkit.googleapis.com',
      port: 443,
      path: `/v1/accounts:signInWithPassword?key=${API_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.error) {
            reject(new Error(response.error.message));
          } else {
            resolve({
              uid: response.localId,
              idToken: response.idToken
            });
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Paso 2: Crear documento en Firestore
function createUserDocument(uid, idToken) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      fields: {
        email: {
          stringValue: USER_EMAIL
        },
        nombre: {
          stringValue: 'Gerardo'
        },
        apellidoPaterno: {
          stringValue: 'Arroyo'
        },
        apellidoMaterno: {
          stringValue: 'Admin'
        },
        rol: {
          stringValue: 'ADMIN'
        },
        createdAt: {
          timestampValue: new Date().toISOString()
        },
        updatedAt: {
          timestampValue: new Date().toISOString()
        }
      }
    });

    const options = {
      hostname: 'firestore.googleapis.com',
      port: 443,
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/usuarios?documentId=${uid}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.error) {
            reject(new Error(response.error.message));
          } else {
            resolve(response);
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Función principal
async function main() {
  try {
    console.log('🔐 Autenticando usuario...');
    const { uid, idToken } = await authenticateUser();
    console.log('✅ Usuario autenticado:', uid);

    console.log('\n📝 Creando documento en Firestore...');
    const result = await createUserDocument(uid, idToken);
    console.log('✅ Documento creado exitosamente!');
    console.log('\n📋 Datos del documento:');
    console.log(JSON.stringify(result, null, 2));

    console.log('\n✨ ¡Todo listo! Ahora puedes iniciar sesión en la aplicación.');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    if (error.message.includes('NOT_FOUND') || error.message.includes('database')) {
      console.log('\n⚠️  FIRESTORE NO ESTÁ HABILITADO');
      console.log('Por favor:');
      console.log('1. Ve a: https://console.firebase.google.com/project/sntss-e2117/firestore');
      console.log('2. Haz clic en "Crear base de datos"');
      console.log('3. Selecciona modo de prueba');
      console.log('4. Selecciona una ubicación (ej: us-central1)');
      console.log('5. Ejecuta este script nuevamente');
    } else if (error.message.includes('permission')) {
      console.log('\n⚠️  ERROR DE PERMISOS');
      console.log('Las reglas de seguridad de Firestore están bloqueando la escritura.');
      console.log('Ve a Firebase Console → Firestore → Reglas y usa estas reglas de prueba:');
      console.log('\nrules_version = \'2\';');
      console.log('service cloud.firestore {');
      console.log('  match /databases/{database}/documents {');
      console.log('    match /{document=**} {');
      console.log('      allow read, write: if request.auth != null;');
      console.log('    }');
      console.log('  }');
      console.log('}');
    }
  }
}

main();
