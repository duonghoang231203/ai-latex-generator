"use client";

import { useState } from "react";
import GeneratorForm, {
  type GeneratorFormValues,
} from "@/app/components/GeneratorForm";
import ResultPanel, { type ResultData } from "@/app/components/ResultPanel";
import StatusBanner, { type Status } from "@/app/components/StatusBanner";

export default function Home() {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<ResultData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>();

  async function handleSubmit(values: GeneratorFormValues) {
    setStatus("loading");
    setResult(null);
    setErrorMessage(undefined);
    try {
      const res = await fetch("/api/document", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json()) as ResultData;
      if (!res.ok) {
        setStatus("error");
        setErrorMessage(data.error ?? `Lỗi ${res.status}`);
        return;
      }
      setResult(data);
      if (data.error) {
        // Thất bại nghiệp vụ (repair loop vượt N lần) — vẫn hiển thị latex/log.
        setStatus("error");
        setErrorMessage(data.error);
      } else {
        setStatus("success");
      }
    } catch {
      setStatus("error");
      setErrorMessage("Không kết nối được máy chủ. Vui lòng thử lại.");
    }
  }

  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-8 p-6 md:grid-cols-2">
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">AI LaTeX Generator</h1>
        <GeneratorForm onSubmit={handleSubmit} busy={status === "loading"} />
        <StatusBanner
          status={status}
          attempts={result?.attempts}
          errorMessage={errorMessage}
        />
      </section>
      <section className="flex flex-col gap-4">
        {result ? (
          <ResultPanel result={result} />
        ) : (
          <p className="text-sm text-zinc-500">
            Kết quả (PDF + mã nguồn) sẽ hiển thị ở đây.
          </p>
        )}
      </section>
    </main>
  );
}
