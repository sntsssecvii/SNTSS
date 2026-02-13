const https = require('https');

const API_KEY = 'AIzaSyAoGMgaouxlJgO6ZtDcN5xENh4jA6DZv90';
const PROJECT_ID = 'sntss-e2117';
const EMAIL = 'gerardoyx@hotmail.com';
const PASSWORD = '123456';

// Paso 1: Autenticar y obtener UID y token
function authenticate() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
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
      res.on('data', (chunk) => { data += chunk; });
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

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Paso 2: Crear documento en Firestore
function createDocument(uid, idToken) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    
    const postData = JSON.stringify({
      fields: {
        email: { stringValue: EMAIL },
        nombre: { stringValue: 'Gerardo' },
        apellidoPaterno: { stringValue: 'Arroyo' },
        apellidoMaterno: { stringValue: 'Arguelles' },
        rol: { stringValue: 'ADMIN' },
        createdAt: { timestampValue: now },
        updatedAt: { timestampValue: now }
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
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({ statusCode: res.statusCode, response });
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Ejecutar
async function main() {
  try {
    console.log('🔐 Autenticando usuario...');
    const { uid, idToken } = await authenticate();
    console.log('✅ Autenticado exitosamente');
    console.log(`   UID: ${uid}`);
    console.log('');
    
    console.log('📝 Creando documento en Firestore...');
    console.log(`   Ruta: usuarios/${uid}`);
    
    const { statusCode, response } = await createDocument(uid, idToken);
    
    if (statusCode === 200 || statusCode === 201) {
      console.log('✅ ¡Documento creado exitosamente!');
      console.log('');
      console.log('📋 Datos del documento:');
      if (response.fields) {
        console.log(`   - email: ${response.fields.email?.stringValue}`);
        console.log(`   - nombre: ${response.fields.nombre?.stringValue}`);
        console.log(`   - apellidoPaterno: ${response.fields.apellidoPaterno?.stringValue}`);
        console.log(`   - apellidoMaterno: ${response.fields.apellidoMaterno?.stringValue}`);
        console.log(`   - rol: ${response.fields.rol?.stringValue}`);
      }
      console.log('');
      console.log('✨ ¡Listo! Ahora prueba el login en http://localhost:3000');
    } else if (response.error) {
      if (response.error.code === 404) {
        console.error('❌ ERROR: Firestore no está habilitado o no está completamente inicializado');
        console.error('');
        console.error('SOLUCIÓN:');
        console.error('1. Ve a: https://console.firebase.google.com/project/sntss-e2117/firestore');
        console.error('2. Haz clic en "Crear base de datos" si no está creada');
        console.error('3. Selecciona "Modo de prueba"');
        console.error('4. Selecciona ubicación: us-central1');
        console.error('5. Ejecuta este script nuevamente');
      } else if (response.error.code === 403 || response.error.status === 'PERMISSION_DENIED') {
        console.error('❌ ERROR: Permisos denegados');
        console.error('');
        console.error('SOLUCIÓN:');
        console.error('1. Ve a: https://console.firebase.google.com/project/sntss-e2117/firestore/rules');
        console.error('2. Pega estas reglas:');
        console.error('');
        console.error('rules_version = \'2\';');
        console.error('service cloud.firestore {');
        console.error('  match /databases/{database}/documents {');
        console.error('    match /{document=**} {');
        console.error('      allow read, write: if request.auth != null;');
        console.error('    }');
        console.error('  }');
        console.error('}');
        console.error('');
        console.error('3. Haz clic en "Publicar"');
        console.error('4. Ejecuta este script nuevamente');
      } else {
        console.error('❌ ERROR:', response.error.message);
        console.error('   Código:', response.error.code);
        console.error('   Status:', response.error.status);
      }
    } else {
      console.error('❌ ERROR desconocido:', JSON.stringify(response, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();
