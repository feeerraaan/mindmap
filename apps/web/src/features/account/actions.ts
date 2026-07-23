'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { prisma } from '@mindmap/database'
import { getCurrentUser, requireUser } from '@mindmap/auth'
import { setLocaleCookie, setThemeCookie } from '@/lib/preferences'

const OnboardingSchema = z.object({
  purpose: z.enum(['medicine', 'law', 'finance', 'engineering', 'language', 'other']),
  confidence: z.enum(['low', 'mid', 'high']),
  mindName: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  locale: z.enum(['en', 'es']).default('en'),
})

export async function completeOnboarding(input: z.input<typeof OnboardingSchema>) {
  const user = await requireUser()
  const data = OnboardingSchema.parse(input)

  const prior = {
    purpose: data.purpose,
    confidence: data.confidence,
    completedAt: new Date().toISOString(),
  }

  const defaultName = data.mindName ?? 'My first Mind'
  const emoji = data.purpose === 'medicine' ? '🩺' : data.purpose === 'law' ? '⚖️' : data.purpose === 'finance' ? '📈' : data.purpose === 'engineering' ? '🛠️' : data.purpose === 'language' ? '🌐' : '🧠'

  const workspace = await prisma.workspace.upsert({
    where: { id: `ws_${user.id}_first` },
    update: { name: defaultName, emoji, prior },
    create: {
      id: `ws_${user.id}_first`,
      ownerId: user.id,
      name: defaultName,
      emoji,
      prior,
    },
  })

  await prisma.user.update({
    where: { id: user.id },
    data: {
      locale: data.locale,
      name: user.name ?? user.email.split('@')[0]!,
    },
  })

  await setLocaleCookie(data.locale)

  revalidatePath('/mind')
  revalidatePath('/onboarding')
  redirect(`/mind/${workspace.id}`)
}

const CreateMindSchema = z.object({
  name: z.string().trim().min(1).max(60),
  emoji: z.string().max(8).optional(),
  locale: z.enum(['en', 'es']).default('en'),
})

export async function createMind(input: z.input<typeof CreateMindSchema>) {
  const user = await requireUser()
  const data = CreateMindSchema.parse(input)
  const workspace = await prisma.workspace.create({
    data: {
      ownerId: user.id,
      name: data.name,
      emoji: data.emoji ?? null,
    },
  })
  revalidatePath('/mind')
  redirect(`/mind/${workspace.id}`)
}

const RenameMindSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(60),
  emoji: z.string().max(8).nullable().optional(),
})

export async function renameMind(input: z.input<typeof RenameMindSchema>) {
  const user = await requireUser()
  const data = RenameMindSchema.parse(input)
  const ws = await prisma.workspace.findUnique({ where: { id: data.id } })
  if (!ws || ws.ownerId !== user.id) throw new Error('Not found')
  await prisma.workspace.update({
    where: { id: data.id },
    data: { name: data.name, emoji: data.emoji === undefined ? ws.emoji : data.emoji },
  })
  revalidatePath('/mind')
  revalidatePath(`/mind/${data.id}`)
}

export async function deleteMind(id: string) {
  const user = await requireUser()
  const ws = await prisma.workspace.findUnique({ where: { id } })
  if (!ws || ws.ownerId !== user.id) throw new Error('Not found')
  await prisma.workspace.delete({ where: { id } })
  revalidatePath('/mind')
  redirect('/mind')
}

const UpdateProfileSchema = z.object({
  name: z.string().trim().min(1).max(60),
  locale: z.enum(['en', 'es']).default('en'),
})

export async function updateProfile(input: z.input<typeof UpdateProfileSchema>) {
  const user = await requireUser()
  const data = UpdateProfileSchema.parse(input)
  await prisma.user.update({
    where: { id: user.id },
    data: { name: data.name, locale: data.locale },
  })
  await setLocaleCookie(data.locale)
  revalidatePath('/settings')
  revalidatePath('/mind')
}

const UpdateThemeSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
})

export async function updateTheme(input: z.input<typeof UpdateThemeSchema>) {
  await getCurrentUser() // require auth
  const data = UpdateThemeSchema.parse(input)
  await setThemeCookie(data.theme)
  revalidatePath('/', 'layout')
}

export async function requestAccountDeletion() {
  const user = await requireUser()
  // Soft delete + audit; phase 8 wires the email confirmation.
  await prisma.user.update({
    where: { id: user.id },
    data: { deletedAt: new Date() },
  })
  await prisma.auditEvent.create({
    data: { userId: user.id, action: 'account.delete_requested' },
  })
}
