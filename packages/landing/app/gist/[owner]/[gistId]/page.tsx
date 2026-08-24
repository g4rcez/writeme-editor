import { redirect } from "next/navigation"

type GistRedirectPageProps = {
  params: Promise<{
    owner: string
    gistId: string
  }>
}

export default async function GistRedirectPage({
  params,
}: GistRedirectPageProps) {
  const { owner, gistId } = await params
  redirect(
    `https://app.writeme.dev/gist/${encodeURIComponent(owner)}/${encodeURIComponent(gistId)}`
  )
}
