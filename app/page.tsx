import HomeClient from "@/app/components/HomeClient";
import { listDocuments } from "@/lib/store/documentStore";

export const dynamic = "force-dynamic";

export default async function Home() {
  const documents = await listDocuments();
  return <HomeClient initialDocuments={documents} />;
}
