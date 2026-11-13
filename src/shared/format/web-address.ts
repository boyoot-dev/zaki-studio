// One web-address check, used by the reply check (src/server/safety/rules.ts) and by the
// bundle validator (src/lib/bundle.ts), so the two can never drift apart (task 135). The
// text comes from a model or from a stranger's file, so it is normalised first: look-alike
// forms become plain ones and hidden format characters drop out. Nothing is imported here,
// and the scan runs in time proportional to the text, so a browser can run it too. It is in
// the golden fingerprint (app/scripts/golden-hash.mjs) because the reply check uses it.

/** The characters a scheme may be made of, and a letter, which a scheme must contain. */
const SCHEME_CHAR = /^[a-z0-9+.-]$/i;
const LETTER = /^[a-z]$/i;
const LETTER_OR_DIGIT = /^[\p{L}\p{N}]$/u;
const WWW = /www\.[\p{L}\p{N}]/iu;

/**
 * True when the text holds a web address: `scheme://` and then a letter or digit, where the
 * scheme contains a letter, or `www.` and then a letter or digit. Runs in time proportional
 * to the text.
 */
export function hasWebAddress(text: string): boolean {
	// NFKC turns full-width and other look-alike forms into plain ones (ｈｔｔｐｓ：／／ becomes
	// https://), and dropping format characters undoes a zero-width space hidden in a scheme.
	const t = text.normalize("NFKC").replace(/\p{Cf}/gu, "");
	for (let at = t.indexOf("://"); at !== -1; at = t.indexOf("://", at + 1)) {
		const host = t.codePointAt(at + 3);
		if (host === undefined || !LETTER_OR_DIGIT.test(String.fromCodePoint(host)))
			continue;
		let start = at;
		while (start > 0 && SCHEME_CHAR.test(t.charAt(start - 1))) start -= 1;
		for (let i = start; i < at; i += 1) {
			if (LETTER.test(t.charAt(i))) return true;
		}
	}
	return WWW.test(t);
}
