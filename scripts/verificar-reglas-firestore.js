/**
 * Script para verificar si las reglas de Firestore permiten lectura
 */

const https = require('https');

const PROJECT_ID = 'sntss-e2117';
const USER_EMAIL = 'gerardoyx@hotmail.com';
const USER_PASSWORD = '123456';
const API_KEY = 'AIzaSyAoGMgaouxlJgO6ZtDcN5xENh4jA6DZv90';

// Paso 1: Autenticar
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
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.error) {
            reject(new Error(response.error.message));
          } else {
            resolve({ uid: response.localId, idToken: response.idToken });
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

// Paso 2: Intentar leer el documento
function readUserDocument(uid, idToken) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'firestore.googleapis.com',
      port: 443,
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/usuarios/${uid}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
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
    req.end();
  });
}

// Función principal
async function main() {
  console.log('🔍 Verificando reglas de Firestore...\n');

  try {
    // Autenticar
    console.log('1️⃣  Autenticando usuario...');
    const { uid, idToken } = await authenticateUser();
    console.log('✅ Usuario autenticado:', uid);
    console.log('');

    // Intentar leer documento
    console.log('2️⃣  Intentando leer documento de Firestore...');
    console.log(`   Ruta: usuarios/${uid}`);
    
    const startTime = Date.now();
    const { statusCode, response } = await readUserDocument(uid, idToken);
    const elapsedTime = Date.now() - startTime;
    
    console.log(`   Tiempo de respuesta: ${elapsedTime}ms`);
    console.log('');

    // Analizar respuesta
    if (statusCode === 200 && response.name) {
      console.log('✅ ¡ÉXITO! El documento se leyó correctamente');
      console.log('');
      console.log('📋 Datos del documento:');
      
      // Extraer campos
      if (response.fields) {
        console.log('   - email:', response.fields.email?.stringValue || 'N/A');
        console.log('   - nombre:', response.fields.nombre?.stringValue || 'N/A');
        console.log('   - apellidoPaterno:', response.fields.apellidoPaterno?.stringValue || 'N/A');
        console.log('   - apellidoMaterno:', response.fields.apellidoMaterno?.stringValue || 'N/A');
        console.log('   - rol:', response.fields.rol?.stringValue || 'N/A');
      }
      
      console.log('');
      console.log('✨ Las reglas de Firestore están configuradas correctamente');
      console.log('');
      console.log('Si el login sigue fallando, el problema puede ser:');
      console.log('   1. Problema de red en el cliente');
      console.log('   2. Problema con la persistencia de Firestore');
      console.log('   3. Conflicto con enableNetwork/disableNetwork');
      console.log('');
      console.log('💡 SOLUCIÓN: Ya actualicé el código para simplificar la conexión.');
      console.log('   Reinicia el servidor (npm run dev) y prueba de nuevo.');
      
    } else if (response.error) {
      console.error('❌ ERROR:', response.error.message);
      console.error('   Código:', response.error.code);
      console.error('   Status:', response.error.status);
      console.log('');
      
      if (response.error.status === 'PERMISSION_DENIED') {
        console.log('🔒 PROBLEMA DE PERMISOS');
        console.log('');
        console.log('Las reglas de Firestore están bloqueando la lectura.');
        console.log('');
        console.log('📝 SOLUCIÓN:');
        console.log('1. Ve a: https://console.firebase.google.com/project/sntss-e2117/firestore/rules');
        console.log('2. Reemplaza las reglas con estas:');
        console.log('');
        console.log('─────────────────────────────────────────');
        console.log("rules_version = '2';");
        console.log('service cloud.firestore {');
        console.log('  match /databases/{database}/documents {');
        console.log('    match /{document=**} {');
        console.log('      allow read, write: if request.auth != null;');
        console.log('    }');
        console.log('  }');
        console.log('}');
        console.log('─────────────────────────────────────────');
        console.log('');
        console.log('3. Haz clic en "Publicar"');
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

main();
