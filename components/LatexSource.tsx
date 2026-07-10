"use client";

export default function LatexSource({ latex }: { latex: string }) {
  return (
    <pre className="max-h-[70vh] overflow-auto rounded border bg-zinc-950 p-4 text-xs text-zinc-100">
      <code>{latex}</code>
    </pre>
  );
}
