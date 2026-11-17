// Makes the Studio's .ico and .icns from its own png (resources/icon.png, the Mr. Zaki face),
// so the window's title bar and the Windows taskbar stop showing Electron's. The .ico is drawn
// from the png. Node only, no package: the png is decoded here, each size is averaged down from the
// pixels it covers, and the .ico is written with plain 32-bit bitmaps, which every Windows
// version reads (and the installer task can hand to the exe). The .icns is the png itself in
// its one chunk, which macOS reads.
//
// It also draws the icon of a .zaki file (task 221, owner 2026-11-17: a file showed the
// app's own face and looked like the app): a white page with a folded corner, the face
// smaller on it and a blue band at the bottom, the way a document's icon looks on Windows
// and macOS. It is drawn at twice the size and averaged down, so its edges are smooth.
//
// Run it when resources/icon.png changes: node scripts/icon.ts

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { crc32, deflateSync, inflateSync } from "node:zlib";

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

/** A png of 8-bit RGBA, unfiltered: what the file icon is saved as. */
function encodePng(rgba: Uint8Array, size: number): Buffer {
	const chunk = (name: string, body: Buffer) => {
		const head = Buffer.alloc(8);
		head.writeUInt32BE(body.length, 0);
		head.write(name, 4, "latin1");
		const sum = Buffer.alloc(4);
		sum.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
		return Buffer.concat([head, body, sum]);
	};
	const header = Buffer.alloc(13);
	header.writeUInt32BE(size, 0);
	header.writeUInt32BE(size, 4);
	header[8] = 8; // 8 bits a channel
	header[9] = 6; // RGBA
	const rows = Buffer.alloc((size * 4 + 1) * size);
	for (let y = 0; y < size; y += 1) {
		rows[y * (size * 4 + 1)] = 0; // no filter
		rows.set(
			rgba.subarray(y * size * 4, (y + 1) * size * 4),
			y * (size * 4 + 1) + 1,
		);
	}
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", header),
		chunk("IDAT", deflateSync(rows)),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

/** The colours of the file icon: the page, its edge, the folded corner and the band. */
const PAGE = [255, 255, 255];
const EDGE = [176, 186, 200];
const FOLD = [222, 228, 236];
const BAND = [47, 107, 216];

/**
 * The .zaki file's icon at 512 pixels: a page with its top right corner folded, the face
 * on it and a band along the bottom. Drawn at 1024 and averaged down to 512.
 */
function fileIcon(face: Image): Image {
	const big = 1024;
	const rgba = new Uint8Array(big * big * 4);
	// The page, in the 1024 drawing.
	const left = 176;
	const right = 848;
	const top = 48;
	const bottom = 976;
	const radius = 40;
	const fold = 208;
	const edge = 14;
	/** Inside the page shrunk by `inset`: a rounded box with its top right corner cut off. */
	const inPage = (x: number, y: number, inset: number) => {
		const l = left + inset;
		const r = right - inset;
		const t = top + inset;
		const b = bottom - inset;
		if (x < l || x > r || y < t || y > b) return false;
		// The cut runs from (right - fold, top) to (right, top + fold), moved in by the inset.
		if (x - (right - fold) - (y - top) > -inset * Math.SQRT2) return false;
		const rr = Math.max(radius - inset, 0);
		const corners: [number, number][] = [
			[l + rr, t + rr],
			[l + rr, b - rr],
			[r - rr, b - rr],
		];
		for (const [cx, cy] of corners) {
			const outX = (x < cx && cx === l + rr) || (x > cx && cx === r - rr);
			const outY = (y < cy && cy === t + rr) || (y > cy && cy === b - rr);
			if (outX && outY && (x - cx) ** 2 + (y - cy) ** 2 > rr ** 2) return false;
		}
		return true;
	};
	/** The folded corner: the triangle under the cut, against the page. */
	const inFold = (x: number, y: number) =>
		x >= right - fold && y <= top + fold && x - (right - fold) <= y - top;
	const bandTop = 790;
	for (let y = 0; y < big; y += 1) {
		for (let x = 0; x < big; x += 1) {
			const px = x + 0.5;
			const py = y + 0.5;
			let colour: number[] | null = null;
			if (inFold(px, py)) {
				const inside =
					px >= right - fold + edge &&
					py <= top + fold - edge &&
					px - (right - fold) <= py - top - edge * Math.SQRT2;
				colour = inside ? FOLD : EDGE;
			} else if (inPage(px, py, 0)) {
				if (!inPage(px, py, edge)) colour = EDGE;
				else colour = py >= bandTop ? BAND : PAGE;
			}
			if (!colour) continue;
			const at = (y * big + x) * 4;
			rgba[at] = colour[0];
			rgba[at + 1] = colour[1];
			rgba[at + 2] = colour[2];
			rgba[at + 3] = 255;
		}
	}
	// The face, 520 pixels across, centred on the page above the band.
	const faceSize = 520;
	const small = shrink(face, faceSize);
	const faceLeft = Math.round((left + right - faceSize) / 2);
	const faceTop = Math.round((top + bandTop - faceSize) / 2) + 20;
	for (let y = 0; y < faceSize; y += 1) {
		for (let x = 0; x < faceSize; x += 1) {
			const from = (y * faceSize + x) * 4;
			const alpha = small[from + 3] / 255;
			if (alpha === 0) continue;
			const at = ((faceTop + y) * big + faceLeft + x) * 4;
			for (let c = 0; c < 3; c += 1)
				rgba[at + c] = Math.round(
					small[from + c] * alpha + rgba[at + c] * (1 - alpha),
				);
			rgba[at + 3] = Math.max(rgba[at + 3], small[from + 3]);
		}
	}
	return {
		width: 512,
		height: 512,
		rgba: shrink({ width: big, height: big, rgba }, 512),
	};
}

const png = readFileSync(SOURCE);
const image = decodePng(png);
mkdirSync(RESOURCES, { recursive: true });
writeFileSync(`${RESOURCES}icon.png`, png);
writeFileSync(`${RESOURCES}icon.ico`, ico(image));
writeFileSync(`${RESOURCES}icon.icns`, icns(png, image.width));
const file = fileIcon(image);
const filePng = encodePng(file.rgba, file.width);
writeFileSync(`${RESOURCES}zaki-file.png`, filePng);
writeFileSync(`${RESOURCES}zaki-file.ico`, ico(file));
writeFileSync(`${RESOURCES}zaki-file.icns`, icns(filePng, file.width));
console.log(
	`icon.png, icon.ico (${SIZES.join(", ")} px) and icon.icns from ${SOURCE}: ${image.width}×${image.height}; zaki-file.png, .ico and .icns for .zaki files`,
);
