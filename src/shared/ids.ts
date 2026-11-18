// Permanent ids for the objects of a curriculum (task 224): units, lessons, skills, exams,
// papers and parts. Mr. Zaki matches a child's progress by them, never by number or
// position, so an id is written once when the object is made and never changed. Eight
// random characters from a-z0-9 give 36^8 (about 2.8e12) values: a course holds a few
// thousand objects, so a repeat is practically impossible, and the format still refuses one.

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** A new id: 8 random characters from a-z0-9. */
export function newId(): string {
	const bytes = new Uint8Array(8);
	crypto.getRandomValues(bytes);
	let out = "";
	// 252 = 7 × 36: bytes at or above it are redrawn, so every character is equally likely.
	for (const byte of bytes) {
		let b = byte;
		while (b >= 252) {
			const again = new Uint8Array(1);
			crypto.getRandomValues(again);
			b = again[0] ?? 0;
		}
		out += ALPHABET[b % 36];
	}
	return out;
}
