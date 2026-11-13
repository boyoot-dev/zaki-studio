// The check the main process makes before it keeps a page picture (task 156): the reader window
// draws the page, and the main process writes only what it can recognise as a PNG of a size a
// page could be. A reader that returned an error page, a truncated file or a bitmap of a whole
// wall would fail here rather than fill the project's folder. Pure and tested.

/** The eight bytes every PNG starts with. */
const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** The smallest a real page picture is: an empty 1×1 PNG is about 70 bytes. */
export const PNG_MIN_BYTES = 100;
/** The largest a page picture may be: a page at 110 DPI is well under this, even at 20 inches. */
export const PNG_MAX_BYTES = 20 * 1024 * 1024;
/** A page's side in pixels. Nothing the Studio draws is bigger, and a huge value is a bug. */
export const PNG_MAX_SIDE = 20000;

/** Why bytes are not a page picture, or "" when they are. */
export function pngProblem(bytes: Uint8Array): string {
	if (!(bytes instanceof Uint8Array)) return "not bytes";
	if (bytes.length < PNG_MIN_BYTES) return `only ${bytes.length} bytes`;
	if (bytes.length > PNG_MAX_BYTES) return `${bytes.length} bytes is too large`;
	for (const [i, byte] of SIGNATURE.entries()) {
		if (bytes[i] !== byte) return "not a PNG";
	}
	// The first chunk must be IHDR, which carries the picture's width and height.
	const type = String.fromCharCode(
		bytes[12] ?? 0,
		bytes[13] ?? 0,
		bytes[14] ?? 0,
		bytes[15] ?? 0,
	);
	if (type !== "IHDR") return "not a PNG";
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const width = view.getUint32(16);
	const height = view.getUint32(20);
	if (width < 1 || height < 1) return "a picture with no size";
	if (width > PNG_MAX_SIDE || height > PNG_MAX_SIDE)
		return `${width}×${height} is too large`;
	return "";
}

/** The width and height of a page picture, or null when the bytes are not one. */
export function pngSize(
	bytes: Uint8Array,
): { width: number; height: number } | null {
	if (pngProblem(bytes) !== "") return null;
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	return { width: view.getUint32(16), height: view.getUint32(20) };
}
