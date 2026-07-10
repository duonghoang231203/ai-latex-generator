import { redirect } from "next/navigation";
import DocumentWorkspace from "@/components/DocumentWorkspace";
import { getDocument } from "@/lib/store/documentStore";
import { getCurrentUserId } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect(`/login?redirectTo=/documents/${id}`);
  }
  const doc = await getDocument(id, userId);
  return <DocumentWorkspace initialDoc={doc} />;
}
