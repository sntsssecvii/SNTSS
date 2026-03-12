const https = require('https');

const PROJECT_ID = 'sntss-e2117';
const API_KEY = 'AIzaSyAoGMgaouxlJgO6ZtDcN5xENh4jA6DZv90';

// Función para autenticar
function authenticate(email, password) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      email,
      password,
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
            resolve({ uid: response.localId, idToken: response.idToken, email: response.email });
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

// Función para leer documento
function readDocument(uid, idToken) {
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
          resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const email = process.argv[2] || 'supervision.afilbc@gmail.com';
  const password = process.argv[3] || prompt('Contraseña: ') || '';
  
  if (!password) {
    console.error('❌ Se requiere contraseña');
    console.log('Uso: node scripts/ops/verificar-usuario-firestore.js <email> <password>');
    process.exit(1);
  }
  
  console.log(`🔍 Verificando usuario: ${email}\n`);
  
  try {
    // Autenticar
    console.log('1️⃣  Autenticando...');
    const { uid, idToken, email: authEmail } = await authenticate(email, password);
    console.log(`✅ Autenticado: ${authEmail}`);
    console.log(`   UID: ${uid}\n`);
    
    // Leer documento
    console.log('2️⃣  Verificando documento en Firestore...');
    console.log(`   Ruta: usuarios/${uid}\n`);
    
    const { statusCode, data } = await readDocument(uid, idToken);
    
    if (statusCode === 200 && data.name) {
      console.log('✅ ¡DOCUMENTO EXISTE!');
      console.log('\n📋 Datos:');
      if (data.fields) {
        Object.keys(data.fields).forEach(key => {
          const field = data.fields[key];
          const value = field.stringValue || field.integerValue || field.booleanValue || field.timestampValue || JSON.stringify(field);
          console.log(`   - ${key}: ${value}`);
        });
      }
    } else if (statusCode === 404) {
      console.log('❌ DOCUMENTO NO EXISTE');
      console.log(`\n⚠️  El usuario ${email} está autenticado pero NO tiene documento en Firestore.`);
      console.log(`\n📝 SOLUCIÓN:`);
      console.log(`   1. Ve a Firebase Console → Firestore → Data`);
      console.log(`   2. Crea un documento en la colección 'usuarios' con ID: ${uid}`);
      console.log(`   3. Agrega estos campos:`);
      console.log(`      - email: "${email}"`);
      console.log(`      - nombre: "Supervisión"`);
      console.log(`      - apellidoPaterno: "Afil"`);
      console.log(`      - apellidoMaterno: "BC"`);
      console.log(`      - rol: "ADMIN" (o el rol que corresponda)`);
    } else {
      console.log(`❌ Error: ${statusCode}`);
      console.log(JSON.stringify(data, null, 2));
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.message.includes('INVALID_PASSWORD') || error.message.includes('EMAIL_NOT_FOUND')) {
      console.log('\n⚠️  Credenciales incorrectas o usuario no existe en Firebase Auth');
    }
  }
}

main();
