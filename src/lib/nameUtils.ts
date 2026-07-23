const LOWERCASE_WORDS = new Set(["de", "del", "la", "las", "los", "y"]);

export function standardizeName(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, " ");
  if (!cleaned) return "";

  return cleaned
    .split(", ")
    .map((part) =>
      part
        .split(" ")
        .map((word, i) => {
          const lower = word.toLocaleLowerCase("es");
          if (i > 0 && LOWERCASE_WORDS.has(lower)) return lower;
          return lower.charAt(0).toLocaleUpperCase("es") + lower.slice(1);
        })
        .join(" ")
    )
    .join(", ");
}
