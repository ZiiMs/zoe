export function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function buildListHref(searchParams: Record<string, string | string[] | undefined>) {
  const next = new URLSearchParams();
  const allowedParams = [
    "league",
    "search",
    "class",
    "keystones",
    "skills",
    "supports",
    "gear",
    "sort",
    "order",
    "page"
  ];

  for (const key of allowedParams) {
    const value = searchParams[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item) {
          next.append(key, item);
        }
      }
    } else if (value) {
      next.set(key, value);
    }
  }

  const query = next.toString();
  return query ? `/?${query}` : "/";
}
