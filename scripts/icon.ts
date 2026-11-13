// Makes the Studio's .ico and .icns from its own png (resources/icon.png, the Mr. Zaki face),
// so the window's title bar and the Windows taskbar stop showing Electron's. The .ico is drawn
// from the png. Node only, no package: the png is decoded here, each size is averaged down from the
// pixels it covers, and the .ico is written with plain 32-bit bitmaps, which every Windows
// version reads (and the installer task can hand to the exe). The .icns is the png itself in
// its one chunk, which macOS reads.
//
// Run it when resources/icon.png changes: node scripts/icon.ts

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

/** The sizes Windows asks a taskbar or Explorer for; 256 is the large tile. */
const SIZES = [16, 24, 32, 48, 64, 256] as const;

/** The Studio's own icon, 512 pixels square. */
const SOURCE = fileURLToPath(new URL("../resources/icon.png", import.meta.url));

/** Where the Studio keeps what it ships. */
const RESOURCES = fileURLToPath(new URL("../resources/", import.meta.url));

/** A picture as the browser sees it: red, green, blue and alpha, one byte each. */
type Image = { width: number; height: number; rgba: Uint8Array };

/** The bytes of every chunk of a png, by its four-letter name, in file order. */
function pngChunks(bytes: Buffer): Map<string, Buffer[]> {
	if (bytes.readUInt32BE(0) !== 0x89504e47) throw new Error("not a png");
	const chunks = new Map<string, Buffer[]>();
	let at = 8;
	while (at + 8 <= bytes.length) {
		const length = bytes.readUInt32BE(at);
		const name = bytes.toString("latin1", at + 4, at + 8);
		const body = bytes.subarray(at + 8, at + 8 + length);
		const list = chunks.get(name) ?? [];
		list.push(body);
		chunks.set(name, list);
		at += 12 + length;
	}
	return chunks;
}

/** Reads a png of 8-bit colour, without interlacing, which is what the app's icon is. */
function decodePng(bytes: Buffer): Image {
	const chunks = pngChunks(bytes);
	const header = chunks.get("IHDR")?.[0];
	if (header === undefined) throw new Error("the png has no header");
	const width = header.readUInt32BE(0);
	const height = header.readUInt32BE(4);
	const depth = header[8];
	const colour = header[9];
	const interlace = header[12];
	if (depth !== 8 || (colour !== 2 && colour !== 6) || interlace !== 0)
		throw new Error(
			`the png is depth ${depth}, colour ${colour}, interlace ${interlace}; expected 8-bit RGB or RGBA`,
		);
	const data = inflateSync(Buffer.concat(chunks.get("IDAT") ?? []));
	const bpp = colour === 6 ? 4 : 3;
	const stride = width * bpp;
	const rgba = new Uint8Array(width * height * 4);
	const line = new Uint8Array(stride);
	const before = new Uint8Array(stride);
	for (let y = 0; y < height; y += 1) {
		const filter = data[y * (stride + 1)] ?? 0;
		const row = data.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
		for (let x = 0; x < stride; x += 1) {
			const left = x >= bpp ? line[x - bpp] : 0;
			const up = before[x];
			const corner = x >= bpp ? before[x - bpp] : 0;
			const raw = row[x] ?? 0;
			let value: number;
			switch (filter) {
				case 0:
					value = raw;
					break;
				case 1:
					value = raw + left;
					break;
				case 2:
					value = raw + up;
					break;
				case 3:
					value = raw + ((left + up) >> 1);
					break;
				case 4:
					value = raw + paeth(left, up, corner);
					break;
				default:
					throw new Error(`the png uses filter ${filter}`);
			}
			line[x] = value & 0xff;
		}
		for (let x = 0; x < width; x += 1) {
			const from = x * bpp;
			const to = (y * width + x) * 4;
			rgba[to] = line[from];
			rgba[to + 1] = line[from + 1];
			rgba[to + 2] = line[from + 2];
			rgba[to + 3] = bpp === 4 ? line[from + 3] : 255;
		}
		before.set(line);
	}
	return { width, height, rgba };
}

/** The png filter 4: the pixel closest to the one to its left, above and above-left. */
function paeth(left: number, up: number, corner: number): number {
	const estimate = left + up - corner;
	const toLeft = Math.abs(estimate - left);
	const toUp = Math.abs(estimate - up);
	const toCorner = Math.abs(estimate - corner);
	if (toLeft <= toUp && toLeft <= toCorner) return left;
	return toUp <= toCorner ? up : corner;
}

/** The picture at `size` pixels, each pixel the average of the ones it covers. */
function shrink(image: Image, size: number): Uint8Array {
	const out = new Uint8Array(size * size * 4);
	const step = image.width / size;
	for (let y = 0; y < size; y += 1) {
		const top = y * step;
		const bottom = top + step;
		for (let x = 0; x < size; x += 1) {
			const left = x * step;
			const right = left + step;
			let red = 0;
			let green = 0;
			let blue = 0;
			let alpha = 0;
			let weight = 0;
			for (let sy = Math.floor(top); sy < Math.ceil(bottom); sy += 1) {
				const row = Math.min(bottom, sy + 1) - Math.max(top, sy);
				if (row <= 0) continue;
				for (let sx = Math.floor(left); sx < Math.ceil(right); sx += 1) {
					const column = Math.min(right, sx + 1) - Math.max(left, sx);
					if (column <= 0) continue;
					const part = row * column;
					const at = (sy * image.width + sx) * 4;
					red += image.rgba[at] * part;
					green += image.rgba[at + 1] * part;
					blue += image.rgba[at + 2] * part;
					alpha += image.rgba[at + 3] * part;
					weight += part;
				}
			}
			const to = (y * size + x) * 4;
			out[to] = Math.round(red / weight);
			out[to + 1] = Math.round(green / weight);
			out[to + 2] = Math.round(blue / weight);
			out[to + 3] = Math.round(alpha / weight);
		}
	}
	return out;
}

/** One size as the .ico keeps it: a 32-bit bitmap, the mask Windows still expects under it. */
function bitmap(rgba: Uint8Array, size: number): Buffer {
	const rowSize = size * 4;
	const maskRow = Math.ceil(size / 32) * 4;
	const maskSize = maskRow * size;
	const header = Buffer.alloc(40);
	header.writeUInt32LE(40, 0); // the header's own size
	header.writeInt32LE(size, 4);
	header.writeInt32LE(size * 2, 8); // the colours and the mask, one above the other
	header.writeUInt16LE(1, 12);
	header.writeUInt16LE(32, 14);
	header.writeUInt32LE(0, 16); // no compression
	header.writeUInt32LE(rowSize * size + maskSize, 20);
	const pixels = Buffer.alloc(rowSize * size);
	for (let y = 0; y < size; y += 1) {
		// A bitmap is written bottom row first.
		const to = (size - 1 - y) * rowSize;
		for (let x = 0; x < size; x += 1) {
			const from = (y * size + x) * 4;
			pixels[to + x * 4] = rgba[from + 2];
			pixels[to + x * 4 + 1] = rgba[from + 1];
			pixels[to + x * 4 + 2] = rgba[from];
			pixels[to + x * 4 + 3] = rgba[from + 3];
		}
	}
	// Every pixel is drawn from the colours above, so the mask stays empty.
	return Buffer.concat([header, pixels, Buffer.alloc(maskSize)]);
}

/** The .ico: a header, one directory entry per size, then the bitmaps themselves. */
function ico(image: Image): Buffer {
	const images = SIZES.map((size) => ({
		size,
		data: bitmap(shrink(image, size), size),
	}));
	const header = Buffer.alloc(6);
	header.writeUInt16LE(0, 0); // reserved
	header.writeUInt16LE(1, 2); // an icon, not a cursor
	header.writeUInt16LE(images.length, 4);
	const entries = Buffer.alloc(16 * images.length);
	let offset = 6 + entries.length;
	images.forEach(({ size, data }, index) => {
		const at = index * 16;
		// A 0 in the size fields is how an .ico names its 256 pixel picture.
		entries[at] = size === 256 ? 0 : size;
		entries[at + 1] = size === 256 ? 0 : size;
		entries[at + 2] = 0; // no palette
		entries[at + 3] = 0;
		entries.writeUInt16LE(1, at + 4);
		entries.writeUInt16LE(32, at + 6);
		entries.writeUInt32LE(data.length, at + 8);
		entries.writeUInt32LE(offset, at + 12);
		offset += data.length;
	});
	return Buffer.concat([header, entries, ...images.map((one) => one.data)]);
}

/** The .icns the Mac installer shows: the one 512 pixel picture, the png itself inside it. */
function icns(png: Buffer, size: number): Buffer {
	if (size !== 512)
		throw new Error(`the .icns wants the 512 pixel picture, got ${size}`);
	const header = Buffer.alloc(8);
	header.write("icns", 0, "latin1");
	header.writeUInt32BE(8 + 8 + png.length, 4);
	const chunk = Buffer.alloc(8);
	chunk.write("ic09", 0, "latin1"); // ic09: a 512 × 512 png
	chunk.writeUInt32BE(png.length + 8, 4);
	return Buffer.concat([header, chunk, png]);
}

const png = readFileSync(SOURCE);
const image = decodePng(png);
mkdirSync(RESOURCES, { recursive: true });
writeFileSync(`${RESOURCES}icon.png`, png);
writeFileSync(`${RESOURCES}icon.ico`, ico(image));
writeFileSync(`${RESOURCES}icon.icns`, icns(png, image.width));
console.log(
	`icon.png, icon.ico (${SIZES.join(", ")} px) and icon.icns from ${SOURCE}: ${image.width}×${image.height}`,
);
