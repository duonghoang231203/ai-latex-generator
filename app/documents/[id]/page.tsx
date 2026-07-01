import DocumentWorkspace from "@/app/components/DocumentWorkspace";
import { getDocument } from "@/lib/store/documentStore";

export const dynamic = "force-dynamic";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const doc = await getDocument(id);
  return <DocumentWorkspace initialDoc={doc} />;
}
