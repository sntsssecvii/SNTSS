import { z } from 'zod'

export const registroBaseSchema = z.object({
    nombre: z.string().min(2, 'El nombre es muy corto').max(50, 'El nombre es muy largo'),
    apellidoPaterno: z.string().min(2, 'El apellido paterno es muy corto').max(50, 'El apellido paterno es muy largo'),
    apellidoMaterno: z.string().min(2, 'El apellido materno es muy corto').max(50, 'El apellido materno es muy largo'),
    matricula: z
        .string()
        .min(1, 'La matrícula es requerida')
        .max(10, 'La matrícula debe tener máximo 10 dígitos')
        .regex(/^\d+$/, 'La matrícula solo puede contener números'),
    email: z.string().email('Correo electrónico inválido'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    confirmPassword: z.string().min(8, 'Confirma una contraseña de al menos 8 caracteres'),
})

export const registroSchema = registroBaseSchema.refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
})

export type RegistroFormData = z.infer<typeof registroSchema>
