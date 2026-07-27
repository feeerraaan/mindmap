import { setRequestLocale, getTranslations } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@mindmap/database'
import { getCurrentUser } from '@mindmap/auth'
import { asLocale } from '@/lib/preferences'
import { UploadDropzone } from '@/components/documents/upload-dropzone'

export const dynamic = 'force-dynamic'

export default async function UploadPage({
  params,
}: {
  params: Promise<{ locale: string; workspaceId: string }>
}) {
  const { locale: rawLocale, workspaceId } = await params
  const locale = asLocale(rawLocale)
  setRequestLocale(locale)
  const user = await getCurrentUser()
  if (!user) redirect(`/${locale}/sign-in?callbackPath=/${locale}/mind/${workspaceId}/upload`)

  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, ownerId: user.id },
    select: { id: true, name: true, emoji: true },
  })
  if (!workspace) notFound()

  const tUpload = await getTranslations({ locale, namespace: 'mind.empty' })
  const tUpload2 = await getTranslations({ locale, namespace: 'upload' })

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8 md:py-12">
      <div className="mb-6 flex items-center gap-3">
        <span aria-hidden className="text-2xl leading-none">
          {workspace.emoji ?? '🧠'}
        </span>
        <div>
          <h1 className="text-headline font-semibold tracking-[-0.023em] text-[var(--color-fg)]">
            {tUpload2('title')}
          </h1>
          <p className="text-sm text-[var(--color-fg-muted)]">{workspace.name}</p>
        </div>
      </div>

      <UploadDropzone
        workspaceId={workspace.id}
        locale={locale}
        labels={{
          dropTitle: tUpload2('dropTitle'),
          dropBody: tUpload2('dropBody'),
          cancel: tUpload2('cancel'),
          retry: tUpload2('retry'),
          done: tUpload2('done'),
          tooBig: tUpload2('tooBig'),
          wrongType: tUpload2('wrongType'),
          errorGeneric: tUpload2('errorGeneric'),
          reading: tUpload2('reading'),
          uploading: tUpload2('uploading'),
          parsing: tUpload2('parsing'),
          ready: tUpload2('ready'),
        }}
      />

      <p className="mt-6 text-center text-xs text-[var(--color-fg-subtle)]">
        {tUpload('uploadHint')}
      </p>
    </div>
  )
}
