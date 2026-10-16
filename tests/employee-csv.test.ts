// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  CsvError,
  decodeCsv,
  detectDelimiter,
  neutralise,
  parseCsv,
  parseRosterCsv,
  serializeCsv,
} from "@/lib/employee/csv";

const enc = (s: string) => new TextEncoder().encode(s);

describe("employee CSV import: parsing", () => {
  it("reads name,email with LF endings and lower-cases the email", () => {
    const r = parseRosterCsv(
      enc("name,email\nAna Souza,ANA@Example.TEST\nBeto,beto@example.test\n"),
    );
    expect(r.valid.map((v) => [v.name, v.email])).toEqual([
      ["Ana Souza", "ana@example.test"],
      ["Beto", "beto@example.test"],
    ]);
    expect(r.invalidCount).toBe(0);
  });

  it("accepts the Portuguese header 'nome', any case", () => {
    expect(parseRosterCsv(enc("Nome,Email\nA,a@x.test\n")).valid).toHaveLength(
      1,
    );
    expect(parseRosterCsv(enc("NAME,EMAIL\nA,a@x.test\n")).valid).toHaveLength(
      1,
    );
  });

  it("strips a UTF-8 BOM", () => {
    const bytes = new Uint8Array([
      0xef,
      0xbb,
      0xbf,
      ...enc("name,email\nA,a@x.test\n"),
    ]);
    expect(parseRosterCsv(bytes).valid).toHaveLength(1);
    expect(decodeCsv(bytes).charCodeAt(0)).not.toBe(0xfeff);
  });

  it("detects ; as the delimiter from the header line", () => {
    expect(detectDelimiter("name;email\nA;a@x.test")).toBe(";");
    expect(detectDelimiter("name,email")).toBe(",");
    const r = parseRosterCsv(enc("nome;email\nJoão da Silva;joao@x.test\n"));
    expect(r.valid[0]).toMatchObject({
      name: "João da Silva",
      email: "joao@x.test",
    });
  });

  it("handles CRLF, lone CR and a missing final newline", () => {
    expect(
      parseRosterCsv(enc("name,email\r\nA,a@x.test\r\nB,b@x.test")).valid,
    ).toHaveLength(2);
    expect(
      parseRosterCsv(enc("name,email\rA,a@x.test\rB,b@x.test\r")).valid,
    ).toHaveLength(2);
  });

  it("handles quoted fields with embedded delimiter, doubled quotes and a newline; line numbers follow", () => {
    const text =
      'name,email\n"Silva, Ana ""Nana""",ana@x.test\n"Multi\nline",bad\nOk,ok@x.test\n';
    const rows = parseCsv(text, ",");
    expect(rows[1].cells[0]).toBe('Silva, Ana "Nana"');
    expect(rows[2].cells[0]).toBe("Multi\nline");
    const r = parseRosterCsv(enc(text));
    expect(r.valid.map((v) => v.name)).toEqual(['Silva, Ana "Nana"', "Ok"]);
    // the bad row started on line 3; the next record starts on line 5 (the quoted newline counts)
    expect(r.invalid).toEqual([{ line: 3, reason: "email_invalid" }]);
    expect(r.valid[1].line).toBe(5);
  });

  it("skips blank lines and an empty trailing line", () => {
    const r = parseRosterCsv(enc("name,email\n\nA,a@x.test\n\n\n"));
    expect(r.valid).toHaveLength(1);
    expect(r.invalidCount).toBe(0);
  });

  it("imports valid rows and reports invalid ones by line with a reason (ragged rows included)", () => {
    const r = parseRosterCsv(
      enc(
        [
          "name,email",
          "Good,good@x.test", // 2
          "OnlyName", // 3 ragged
          ",noname@x.test", // 4
          `${"x".repeat(121)},long@x.test`, // 5
          "Bad,not-an-email", // 6
          "Extra,extra@x.test,ignored,cells", // 7 extra cells are ignored
        ].join("\n"),
      ),
    );
    expect(r.valid.map((v) => v.email)).toEqual([
      "good@x.test",
      "extra@x.test",
    ]);
    expect(r.invalid).toEqual([
      { line: 3, reason: "columns" },
      { line: 4, reason: "name_empty" },
      { line: 5, reason: "name_long" },
      { line: 6, reason: "email_invalid" },
    ]);
  });

  it("rejects emails over 254 chars and obvious garbage", () => {
    const long = `${"a".repeat(250)}@x.test`;
    const r = parseRosterCsv(
      enc(`name,email\nA,${long}\nB,a@b\nC,a b@x.test\nD,a..b@x.test\n`),
    );
    expect(r.valid).toHaveLength(0);
    expect(r.invalidCount).toBe(4);
  });

  it("duplicates inside the file keep the first row", () => {
    const r = parseRosterCsv(
      enc("name,email\nFirst,dup@x.test\nSecond,DUP@x.test\n"),
    );
    expect(r.valid.map((v) => v.name)).toEqual(["First"]);
    expect(r.duplicatesInFile).toBe(1);
  });

  it("lists at most 20 invalid rows but counts them all", () => {
    const body = Array.from({ length: 30 }, (_, i) => `N${i},bad${i}`).join(
      "\n",
    );
    const r = parseRosterCsv(enc(`name,email\n${body}\n`));
    expect(r.invalid).toHaveLength(20);
    expect(r.invalidCount).toBe(30);
  });

  it("allows exactly 500 data rows and refuses 501", () => {
    const mk = (n: number) =>
      "name,email\n" +
      Array.from({ length: n }, (_, i) => `N${i},u${i}@x.test`).join("\n");
    expect(parseRosterCsv(enc(mk(500))).valid).toHaveLength(500);
    expect(() => parseRosterCsv(enc(mk(501)))).toThrow(CsvError);
    try {
      parseRosterCsv(enc(mk(501)));
    } catch (e) {
      expect((e as CsvError).code).toBe("too_many_rows");
    }
  });

  it("refuses files over 256 KB", () => {
    const big = new Uint8Array(256 * 1024 + 1).fill(97);
    expect(() => parseRosterCsv(big)).toThrow(/too_large/);
  });

  it("binary garbage and invalid UTF-8 give a friendly CsvError, not a crash", () => {
    expect(() =>
      parseRosterCsv(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0])),
    ).toThrow(/not_text/);
    expect(() =>
      parseRosterCsv(new Uint8Array([0xff, 0xfe, 0xfd, 0xfc])),
    ).toThrow(/not_text/);
  });

  it("empty file, wrong header and an unclosed quote are CsvErrors with a code", () => {
    const code = (b: Uint8Array) => {
      try {
        parseRosterCsv(b);
      } catch (e) {
        return (e as CsvError).code;
      }
      return "no error";
    };
    expect(code(enc(""))).toBe("empty");
    expect(code(enc("\n\n"))).toBe("empty");
    expect(code(enc("email,name\nA,a@x.test"))).toBe("bad_header");
    expect(code(enc("name\nA"))).toBe("bad_header");
    expect(code(enc('name,email\n"open,a@x.test\n'))).toBe(
      "unterminated_quote",
    );
  });
});

describe("employee CSV export: serializer", () => {
  it("neutralises formula injection: = + - @ tab CR get a leading apostrophe", () => {
    for (const bad of ["=1+1", "+cmd", "-2", "@SUM(A1)", "\tx", "\rx"])
      expect(neutralise(bad)).toBe(`'${bad}`);
    for (const ok of ["Ana", "a=b", "x+y", "", "1"])
      expect(neutralise(ok)).toBe(ok);
  });

  it("quotes cells with commas, quotes and newlines; CRLF row ends; null -> empty", () => {
    const out = serializeCsv([
      ["a", 'b"c', "d,e", "f\ng", null, undefined, 5],
      ['=HYPERLINK("http://x")', "ok"],
    ]);
    expect(out).toBe(
      `a,"b""c","d,e","f\ng",,,5\r\n"'=HYPERLINK(""http://x"")",ok\r\n`,
    );
  });

  it("round-trips through the parser (apart from the apostrophe on formula cells)", () => {
    const rows = [
      ['Ana, "A"', "ana@x.test"],
      ["Line\nbreak", "b@x.test"],
    ];
    const parsed = parseCsv(serializeCsv(rows), ",");
    expect(parsed.map((r) => r.cells)).toEqual(rows);
  });
});
