import type { FaqItem } from "@/lib/seo/conversion-pages";

export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div className="divide-y divide-border rounded-xl border border-border">
      {items.map((item) => (
        <details key={item.question} className="group p-4">
          <summary className="cursor-pointer list-none font-medium marker:content-none">{item.question}</summary>
          <p className="mt-2 text-sm text-muted">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
