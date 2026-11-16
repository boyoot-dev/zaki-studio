// The exam numbers that describe the same thing (task 192): each check fires on a minimal
// mismatch, stays silent when the numbers agree or a number is absent, and the safe fixes leave
// numbers that then pass. Every exam here is made up.

import { describe, expect, it } from "vitest";

import {
	applyExamFix,
	courseNumberWarnings,
	type ExamNumberCode,
	examNumberWarnings,
} from "./exam-numbers.ts";
import type {
	BundleExam,
	BundlePaper,
	BundlePart,
	BundleQuestions,
} from "./format/bundle.ts";

/** One part whose numbers agree: two short questions, one mark each, worth two. */
function part(
	over: Partial<BundleQuestions> = {},
	marks: number | null = 2,
): BundlePart {
	return {
		id: "p1",
		name: "A part",
		nameEn: null,
		instruction: null,
		instructionEn: null,
		marks,
		minutes: null,
		material: {
			kind: "none",
			description: null,
			words: null,
			speakers: null,
			topic: null,
			layout: [],
			timing: null,
		},
		questions: {
			count: 2,
			types: { short: 2 },
			choiceOptions: null,
			maxWords: null,
			answerWords: null,
			marksEach: 1,
			marksByType: null,
			totalMarks: 2,
			example: null,
			copiedExactly: null,
			...over,
		},
		notes: null,
		marking: null,
	};
}

/** One paper whose numbers agree: one part worth two marks. */
function paper(over: Partial<BundlePaper> = {}): BundlePaper {
	return {
		name: "Writing",
		skill: "writing",
		language: null,
		minutes: 60,
		marks: 2,
		parts: [part()],
		...over,
	};
}

/** One exam whose numbers agree: one paper of one part. */
function exam(over: Partial<BundleExam> = {}): BundleExam {
	return { period: null, name: "Final", papers: [paper()], ...over };
}

/** One exam with one part, `over` on that part's questions. */
function examOf(over: Partial<BundleQuestions>, marks: number | null = 2) {
	return exam({ papers: [paper({ parts: [part(over, marks)] })] });
}

/** The codes an exam's warnings carry, in the order the checks run. */
function codes(value: BundleExam): ExamNumberCode[] {
	return examNumberWarnings(value).map((warning) => warning.code);
}

describe("the numbers of one exam", () => {
	it("keeps count-types silent when fewer questions are typed than the count", () => {
		expect(codes(examOf({ count: 3, marksEach: null }))).not.toContain(
			"count-types",
		);
	});

	it("says nothing when they agree", () => {
		expect(examNumberWarnings(exam())).toEqual([]);
	});

	it("fires count-types when more questions are typed than the count", () => {
		const warnings = examNumberWarnings(examOf({ count: 1, marksEach: null }));
		expect(warnings.map((warning) => warning.code)).toEqual(["count-types"]);
		expect(warnings[0]?.path).toBe("papers[0].parts[0].questions");
		expect(warnings[0]?.fix).toEqual({
			path: "papers[0].parts[0].questions.count",
			value: 2,
		});
	});

	it("fires total-each when marksEach × count is not totalMarks", () => {
		const warnings = examNumberWarnings(examOf({ marksEach: 1.5 }));
		expect(warnings.map((warning) => warning.code)).toEqual(["total-each"]);
		expect(warnings[0]?.fix).toBeUndefined();
	});

	it("fires total-by-type when the types are worth another total", () => {
		const warnings = examNumberWarnings(
			examOf({
				types: { short: 2 },
				marksByType: { short: 2 },
				marksEach: null,
			}),
		);
		expect(warnings.map((warning) => warning.code)).toEqual(["total-by-type"]);
	});

	it("fires part-total when the part's marks are not its totalMarks", () => {
		const warnings = examNumberWarnings(
			exam({
				papers: [
					paper({
						marks: 3,
						parts: [part({ totalMarks: 2 }, 3)],
					}),
				],
			}),
		);
		expect(warnings.map((warning) => warning.code)).toEqual(["part-total"]);
		expect(warnings[0]?.path).toBe("papers[0].parts[0]");
	});

	it("fires paper-parts when the paper's marks are not the sum of its parts", () => {
		const warnings = examNumberWarnings(
			exam({ papers: [paper({ marks: 5 })] }),
		);
		expect(warnings.map((warning) => warning.code)).toEqual(["paper-parts"]);
		expect(warnings[0]?.path).toBe("papers[0]");
		expect(warnings[0]?.fix).toEqual({ path: "papers[0].marks", value: 2 });
	});

	it("fires choice-options when no question is choice or multi", () => {
		const warnings = examNumberWarnings(examOf({ choiceOptions: 3 }));
		expect(warnings.map((warning) => warning.code)).toEqual(["choice-options"]);
		expect(warnings[0]?.fix).toEqual({
			path: "papers[0].parts[0].questions.choiceOptions",
			value: null,
		});
	});

	it("fires max-answer-words when maxWords is under the shortest answer", () => {
		const warnings = examNumberWarnings(
			examOf({ maxWords: 20, answerWords: [120, 150] }),
		);
		expect(warnings.map((warning) => warning.code)).toEqual([
			"max-answer-words",
		]);
	});

	it("fires both-mark-forms when the two forms disagree for a type", () => {
		// The weighted total still matches, so only the per-type marks disagree.
		const warnings = examNumberWarnings(
			examOf({
				count: 2,
				types: { short: 1, gap: 1 },
				marksEach: 1,
				marksByType: { short: 2, gap: 0 },
			}),
		);
		expect(warnings.map((warning) => warning.code)).toEqual([
			"both-mark-forms",
		]);
	});
});

describe("a number that is absent", () => {
	it("keeps total-each silent", () => {
		expect(codes(examOf({ marksEach: null }))).toEqual([]);
		expect(codes(examOf({ totalMarks: null }))).toEqual([]);
	});

	it("keeps total-by-type silent", () => {
		expect(codes(examOf({ marksByType: null }))).toEqual([]);
		expect(
			codes(examOf({ marksByType: { short: 1 }, totalMarks: null })),
		).toEqual([]);
	});

	it("keeps part-total silent", () => {
		expect(codes(examOf({}, null))).toEqual([]);
		expect(codes(examOf({ totalMarks: null }))).toEqual([]);
	});

	it("keeps paper-parts silent when a part has no marks", () => {
		expect(
			codes(exam({ papers: [paper({ marks: 9, parts: [part({}, null)] })] })),
		).toEqual([]);
		expect(codes(exam({ papers: [paper({ marks: null })] }))).toEqual([]);
	});

	it("keeps max-answer-words silent without an answer length", () => {
		expect(codes(examOf({ maxWords: 20 }))).toEqual([]);
	});

	it("keeps count-types silent when types holds no number", () => {
		expect(codes(examOf({ types: {}, count: 2 }))).toEqual([]);
	});
});

describe("the half-mark tolerance", () => {
	/** One part worth `total`, with its paper and part marks equal to it. */
	function half(total: number) {
		return exam({
			papers: [
				paper({
					marks: total,
					parts: [
						part(
							{
								count: 2,
								types: { short: 2 },
								marksEach: 1.5,
								totalMarks: total,
							},
							total,
						),
					],
				}),
			],
		});
	}

	it("takes halves that agree as equal", () => {
		expect(codes(half(3))).toEqual([]);
	});

	it("still sees a whole half of a difference", () => {
		expect(codes(half(2.5))).toEqual(["total-each"]);
	});
});

describe("a whole course", () => {
	it("counts the warnings of its accepted exams, and leaves a clean course out", () => {
		const graded = exam({
			papers: [paper({ parts: [part({ count: 1, marksEach: null })] })],
		});
		expect(
			courseNumberWarnings([
				{ grade: 9, subject: "arabic", exams: [graded] },
				{ grade: 8, subject: "french", exams: [exam()] },
			]),
		).toEqual([{ grade: 9, subject: "arabic", warnings: 1 }]);
	});
});

describe("a safe fix", () => {
	/** The exam as a change set writes it, with its fix applied. */
	function fixed(value: BundleExam): BundleExam {
		const [warning] = examNumberWarnings(value);
		expect(warning?.fix).toBeDefined();
		const next = applyExamFix(
			JSON.parse(JSON.stringify(value)),
			warning?.fix?.path ?? "",
			warning?.fix?.value ?? null,
		);
		expect(next).not.toBeNull();
		return next as BundleExam;
	}

	it("sets count, and the numbers then agree", () => {
		const next = fixed(examOf({ count: 1 }));
		expect(next.papers[0]?.parts[0]?.questions.count).toBe(2);
		expect(examNumberWarnings(next)).toEqual([]);
	});

	it("sets the paper's marks, and the numbers then agree", () => {
		const next = fixed(exam({ papers: [paper({ marks: 5 })] }));
		expect(next.papers[0]?.marks).toBe(2);
		expect(examNumberWarnings(next)).toEqual([]);
	});

	it("removes choiceOptions, and the numbers then agree", () => {
		const next = fixed(examOf({ choiceOptions: 4 }));
		expect(next.papers[0]?.parts[0]?.questions).not.toHaveProperty(
			"choiceOptions",
		);
		expect(examNumberWarnings(next)).toEqual([]);
	});

	it("refuses a path that leads nowhere", () => {
		const value = JSON.parse(JSON.stringify(exam()));
		expect(applyExamFix(value, "papers[9].marks", 1)).toBeNull();
		expect(applyExamFix(value, "papers[0].parts[0].name", 1)).toBeNull();
		expect(applyExamFix(value, "not a path", 1)).toBeNull();
	});

	it("leaves the set it was given alone", () => {
		const value = examOf({ count: 3 });
		const before = JSON.stringify(value);
		applyExamFix(value, "papers[0].parts[0].questions.count", 2);
		expect(JSON.stringify(value)).toBe(before);
	});
});
