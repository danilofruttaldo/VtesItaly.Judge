/* The links page has no logic of its own: it only registers the SW, so it
 * works offline and shows the update toast like the other pages. */
import { registerServiceWorker } from "./shell.mjs";

registerServiceWorker();
