/** Normalize letter HTML for in-browser iframe preview (absolute brand URLs). */
export function prepareLetterPreviewHtml(html: string, origin = ""): string {
  if (!origin) return html;
  return html
    .replace(/src="\/brand\//g, `src="${origin}/brand/`)
    .replace(/url\(\/brand\//g, `url(${origin}/brand/`);
}
