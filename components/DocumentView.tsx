import type { StructuredDocument } from "@/lib/documents/types";

/** Plain-text rendering: React escapes everything, so merge values can never inject markup. */
export function DocumentView({ doc }: { doc: StructuredDocument }) {
  return (
    <article lang={doc.locale} className="space-y-6">
      <h2 className="text-2xl font-bold">{doc.title}</h2>
      {doc.sections.map((s) => (
        <section key={s.id} id={s.id} className="space-y-2">
          <h3 className="text-lg font-semibold">{s.heading}</h3>
          {s.paragraphs.map((p, i) => (
            <p key={i} className="leading-relaxed text-slate-800">
              {p}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
