/* Editorial "Aggiornato:" date for the vademecum. The staged index.html gets
 * the date of the last commit touching data/vademecum.json as the datetime of
 * <time id="updated">: the Last-Modified header used before moved with every
 * deploy, even a CSS-only one. */

const MARKER = '<time class="updated" id="updated"';

/**
 * @param {string} html
 * @param {string} iso
 * @returns {string}
 */
export function stampUpdated(html, iso) {
  if (!html.includes(MARKER)) throw new Error(`stamp-updated: ${MARKER} not found in index.html`);
  return html.replace(MARKER, `${MARKER} datetime="${iso}"`);
}
