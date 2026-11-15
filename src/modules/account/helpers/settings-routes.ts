export type SettingsSearchParams = Record<string, string | string[] | undefined>;

/** Legacy bookmarks retain query values while moving to their canonical page. */
export function settingsHrefWithQuery(destination: string, values: SettingsSearchParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value !== undefined) query.append(key, value);
  }
  return destination + (query.size ? `?${query}` : "");
}
