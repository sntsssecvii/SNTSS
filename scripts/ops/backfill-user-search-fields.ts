import { adminDb } from '@/lib/firebase/admin'
import { buildUserSearchFields } from '@/lib/firebase/user-search'

async function backfillUserSearchFields() {
  const snapshot = await adminDb.collection('users').get()

  let batch = adminDb.batch()
  let operations = 0
  let updated = 0

  for (const doc of snapshot.docs) {
    const data = doc.data()
    const search = buildUserSearchFields({
      email: data.email,
      matricula: data.matricula,
      nombre: data.nombre,
      apellidoPaterno: data.apellidoPaterno,
      apellidoMaterno: data.apellidoMaterno,
    })

    const current = {
      emailLowercase: data.emailLowercase || '',
      matriculaNormalized: data.matriculaNormalized || '',
      nombreCompletoLowercase: data.nombreCompletoLowercase || '',
    }

    if (
      current.emailLowercase === search.emailLowercase &&
      current.matriculaNormalized === search.matriculaNormalized &&
      current.nombreCompletoLowercase === search.nombreCompletoLowercase
    ) {
      continue
    }

    batch.update(doc.ref, {
      ...search,
      updatedAt: new Date(),
    })
    operations += 1
    updated += 1

    if (operations === 400) {
      await batch.commit()
      batch = adminDb.batch()
      operations = 0
    }
  }

  if (operations > 0) {
    await batch.commit()
  }

  console.log(`Backfill completado. Usuarios actualizados: ${updated}`)
}

backfillUserSearchFields().catch((error) => {
  console.error('Error ejecutando backfill de búsqueda de usuarios:', error)
  process.exit(1)
})
