import type { FaqItem } from "@/lib/faq";

export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <dl className="max-w-3xl space-y-5">
      {items.map(({ q, a }) => (
        <div key={q}>
          <dt className="font-semibold">{q}</dt>
          <dd className="mt-1 text-slate-700">{a}</dd>
        </div>
      ))}
    </dl>
  );
}
