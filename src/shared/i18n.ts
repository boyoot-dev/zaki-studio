// Every word the Studio shows, in English and in simple Modern Standard Arabic, under the
// same keys: a missing Arabic text is a type error. The Studio is English first and Arabic
// second (docs/STUDIO.md), and the window turns right to left in Arabic.

import { gradeName } from "./format/grades.ts";

export type Lang = "en" | "ar";

const en = {
	"app.name": "Mr. Zaki Studio",
	"app.tagline": "Turn your own material into a curriculum.",
	"app.language": "Language",
	"app.startScreen": "Start screen",

	// The start screen.
	"start.new": "New curriculum",
	"start.newHint":
		"Name it, choose the grades and subjects, and the folders are made for you.",
	"start.open": "Open a folder",
	"start.openHint": "Open a project you made before, or a folder of material.",
	"start.recent": "Recent projects",
	"start.recentEmpty":
		"Nothing yet. The projects you open will be listed here.",
	"start.recentMissing": "That folder is not there any more.",
	"start.adopt": "Open my existing material",
	"start.adoptHint":
		"Bring material you prepared before, the work done on it and the curriculum built from it into one project.",

	// The wizard.
	"wizard.step": "Step {n} of 3",
	"wizard.next": "Next",
	"wizard.back": "Back",
	"wizard.create": "Create the folders",
	"wizard.cancel": "Cancel",
	"wizard.creating": "Creating…",
	"wizard.name.title": "What is this curriculum called?",
	"wizard.name.nameEn": "Name in English",
	"wizard.name.nameAr": "Name in Arabic",
	"wizard.name.author": "Author",
	"wizard.name.rights": "Rights",
	"wizard.name.rightsHint":
		"One sentence a parent reads before they import it, e.g. “For my own students only.”",
	"wizard.name.fix": "Fix the marked fields.",
	"wizard.grades.title": "Which grades and subjects?",
	"wizard.grades.hint":
		"Choose the grades, then the subjects that belong to each.",
	"wizard.grades.subjects": "{n:subject}",
	"wizard.grades.fix": "Choose at least one grade and one subject.",
	"wizard.year.title": "How is the year split?",
	"wizard.year.hint":
		"Units sit in one part of the year. The names are yours to change.",
	"wizard.year.finalExam": "Add a final exam that covers the whole year",
	"wizard.year.fix": "Fill in both names of every part.",
	"wizard.preset.terms-blocks": "3 terms × 2 blocks",
	"wizard.preset.semesters": "2 semesters",
	"wizard.preset.terms": "3 terms",
	"wizard.preset.quarters": "4 quarters",
	"wizard.preset.none": "Not split",
	"wizard.period.nameEn": "Name (English)",
	"wizard.period.nameAr": "Name (Arabic)",
	"wizard.folders.title": "These folders will be made",
	"wizard.folders.hint": "Inside {root}",

	// The project window.
	"project.inbox": "Inbox",
	"project.inboxCount": "{n} to sort",
	"project.inboxEmpty":
		"Nothing to sort. Files dropped here wait until you place them.",
	"project.newUnit": "New unit",
	"project.rename": "Rename",
	"project.delete": "Delete",
	"project.moveTo": "Move to…",
	"project.move": "Move",
	"project.grade": "Grade",
	"project.subject": "Subject",
	"project.section": "Section",
	"project.unit": "Unit",
	"project.choose": "Choose…",
	"project.section.Units": "Units",
	"project.section.Books": "Books",
	"project.section.Extra": "Extra",
	"project.section.Exam": "Exam",
	"project.dropHere": "Drop sheets here",
	"project.dropHint": "Or paste with Ctrl+V. Files are copied in, never moved.",
	"project.pickFile": "Choose a file to see it here.",
	"project.pickFolder": "Choose a folder in the tree to drop files into it.",
	"project.empty": "This folder is empty.",
	"project.files": "{n:file}",
	"project.tab.files": "Files",
	"project.tab.curriculum": "Curriculum",
	"project.export": "Export curriculum…",

	// The Curriculum view.
	"curriculum.loading": "Reading the curriculum…",
	"language.title": "Language and help",
	"language.teaching": "Taught in",
	"language.help": "Help in",
	"language.helpHint":
		"Mr. Zaki may explain in these languages when the child is stuck, and understands the child who writes in them.",
	"language.changeWarn":
		"Mr. Zaki treats a course in another language as a different course, so children's progress on it won't carry over. Change it?",
	"language.notYet":
		"Mr. Zaki can't teach in {language} yet. Families will see this course as not available until it can.",
	"language.helpNotYet":
		"Mr. Zaki can't help in {language} yet; the course works without it.",
	"language.applyOthers": "Apply help to other grades…",
	"language.applyHint":
		"The same subject in the grades you tick gets these help languages.",
	"language.apply": "Apply",
	"language.noOthers": "No other grade has this subject.",
	"language.saved": "Saved.",
	"language.addOther": "Add in another language…",
	"language.addHint":
		"The same subject, taught in another language. It stays empty until you give it files.",
	"language.add": "Add",
	"language.addNone": "This subject already has every language.",
	"language.added":
		"Added {subject} in {language}. Give it files in the Files tab; it shows here after its first accepted change.",
	"wizard.language": "Most of this curriculum is taught in",
	"wizard.languageHint":
		"Language subjects are taught in their own language. You can change any course later in the Curriculum tab.",
	"export.languageWarn": "{course}: {text}",
	"curriculum.empty":
		"No units yet. Write the notes for your files in Notes, then propose the units in Changes to review.",
	"curriculum.units": "Units",
	"curriculum.period": "Period",
	"curriculum.skills": "Skills",
	"curriculum.facts": "Facts",
	"curriculum.noFacts": "No facts in this lesson.",
	"curriculum.exams": "Exams",
	"curriculum.examStyle": "Exam style",
	"curriculum.source": "Where it came from",
	"curriculum.noPage": "From the curriculum file, no page",
	// Opening a curriculum file (task 214).
	"start.bundle": "Open a curriculum file",
	"start.bundleHint":
		"Make a project from a .zaki file, then add a grade, a block or more material.",
	"bundle.title": "Open a curriculum file",
	"bundle.invalid": "This file can't be opened:",
	"bundle.author": "By {name}",
	"bundle.rights": "Its rights:",
	"bundle.agree": "I may adapt this curriculum (see its rights above).",
	"bundle.hint":
		"Next, choose an empty folder: the project is made there, and its next export is an update of this curriculum.",
	"bundle.make": "Choose a folder and make the project…",
	"curriculum.pickFact": "Choose a fact's page to see it here.",
	"curriculum.pageText": "The page's text",
	"curriculum.noPageText": "No text was read from this page.",
	"curriculum.fileMissing": "That file is not in the project any more.",
	"curriculum.factCount": "{n:fact}",
	"curriculum.lessonCount": "{n:lesson}",
	"curriculum.hideSource": "Hide the source",
	"curriculum.showSource": "Show the source",

	// The borders the author can move between the panes.
	"panes.grades": "The border between the grades and the lesson",
	"panes.source": "The border between the lesson and where it came from",
	"panes.tree": "The border between the tree and the file",
	"panes.hint":
		"Drag it, or use the left and right arrows. Double-click it to go back.",

	// Export.
	"export.title": "Export curriculum",
	"export.summary": "This file will have:",
	"export.courses": "{n:course}",
	"export.units": "{n:unit}",
	"export.lessons": "{n:lesson}",
	"export.facts": "{n:fact}",
	"export.exams": "{n:exam}",
	"export.version": "Version {n}",
	"export.author": "Your name, as the author",
	"export.rights": "The rights sentence a parent reads before importing",
	"export.change": "Change",
	"export.save": "Choose where to save…",
	"export.done": "Exported version {n} as a .zaki file.",
	"export.copy": "A copy is kept in this project.",
	"export.problems": "Nothing was written. These problems stop the file:",
	"export.working": "Checking the file…",
	"export.examWarnings":
		"Exam numbers that don't add up: {n:number}. The export still works.",
	"export.examWarningCourse": "{course} · {n}",
	"export.openExamCourse": "Open the course",

	// The viewers.
	"viewer.page": "Page {n} of {total}",
	"viewer.previous": "Previous page",
	"viewer.next": "Next page",
	"viewer.zoomIn": "Bigger",
	"viewer.zoomOut": "Smaller",
	"viewer.wordNote":
		"The text of the Word file, in its order, without its layout.",
	"viewer.openInApp": "Open in its app",
	"viewer.openHint": "This file has no viewer here yet.",
	"viewer.audio": "Audio",
	"viewer.pdfFailed": "This PDF could not be opened.",
	"viewer.imageFailed": "This image could not be opened.",
	"viewer.textFailed": "This file could not be read as text.",
	"viewer.loading": "Reading…",
	"viewer.noText": "This Word file holds no text.",

	// Actions and their results.
	"toast.added": "Added {n:file}.",
	"toast.addedSkipped": "Added {n:file}, skipped {skipped:file}.",
	"toast.moved": "Moved.",
	"toast.renamed": "Renamed.",
	"toast.deleted": "Moved to the Recycle Bin.",
	"toast.pasted": "Pasted.",
	"toast.unitMade": "New unit made.",
	"toast.alreadyProject": "This folder is already a project. Opened it.",
	"prompt.renameTitle": "Rename",
	"prompt.unitTitle": "Name the new unit",
	"prompt.unitHint": "It is numbered for you: “03 Energy” follows “02 Cells”.",
	"prompt.placeholder": "Name",

	// Why something didn't happen, and the next step where there is one.
	"failure.outside": "That path is outside the project. Choose one inside it.",
	"failure.notOpen":
		"That folder is not open in the Studio. Open the project again.",
	"failure.missing":
		"That file or folder is not there any more. Look for new material to refresh the list.",
	"failure.tooLarge":
		"That file is too large to show here. Open it in its own app.",
	"failure.unreadable":
		"That file could not be read. Close it if another program has it open, and try again.",
	"failure.nameTaken":
		"That name is already used in this folder. Choose another name.",
	"failure.invalidName":
		"That name can't be used on Windows. Choose another name.",
	"failure.invalidProject":
		"This folder's curriculum.json is not a Studio project. Open another folder.",
	"failure.noWork":
		"There is no _work folder beside that material. Choose the folder that holds it.",
	"failure.emptyModel":
		"This project has no curriculum to export yet. Add a course first.",
	"failure.invalidBundle":
		"The file did not pass the check. Open it again to see why.",
	"failure.notEmpty": "Choose an empty folder for the new project.",
	"failure.unknown":
		"Something went wrong. Try again; if it happens again, restart the Studio.",
	"failure.cancelled": "",

	"project.tab.new": "New material",
	"project.look": "Look for new material",
	"project.putInFolder": "Put in a folder…",
	"project.putHint":
		"Any folder of the project, including the ones you made yourself.",
	"project.folder": "Folder",
	"project.put": "Put there",

	// The Notes tab (task 157): one note per file, with the author's key or a job folder.
	"project.tab.notes": "Notes",
	"notes.title": "Notes",
	"notes.intro":
		"One study note for each file, written by AI from its text and its unread picture pages. Use your own key, or prepare a folder for your own AI tool.",
	"notes.settings": "Your key and model",
	"notes.model": "Model",
	"notes.limit": "Spending limit for this run (US dollars)",
	"notes.saveSettings": "Save",
	"notes.saved": "Saved.",
	"notes.key": "OpenRouter key",
	"notes.keyPlaceholder": "Paste your key",
	"notes.keyHint":
		"The key is kept encrypted on this computer, and never in the project.",
	"notes.keySet": "A key is set on this computer.",
	"notes.keyMissing": "No key is set yet.",
	"notes.saveKey": "Save the key",
	"notes.clearKey": "Forget the key",
	"notes.testKey": "Test the key",
	"notes.testing": "Testing the key…",
	"notes.testOk": "The key works.",
	"notes.keySaved": "The key is saved on this computer.",
	"notes.keyCleared": "The key is forgotten.",
	"notes.noVision":
		"This model cannot read pictures, so image pages are sent as OCR text only.",
	"notes.unknownModel":
		"OpenRouter's list does not know this model id, so its price is not known.",
	"notes.files": "Files",
	"notes.onlyMissing": "Only files without a note",
	"notes.filterGrade": "Grade",
	"notes.filterSubject": "Subject",
	"notes.filterBlock": "Block",
	"notes.filterYear": "Year",
	"notes.filterKind": "Type",
	"notes.allGrades": "All grades",
	"notes.allSubjects": "All subjects",
	"notes.noneMatch": "No file matches this filter.",
	"notes.chosenHint": "The count includes any file the filter hides.",
	"notes.tickShown": "Tick all shown ({n})",
	"notes.untickShown": "Untick all shown",
	"notes.none": "Every file has a note.",
	"notes.chosen": "Chosen: {n:file}",
	"notes.pages": "{n:page}",
	"notes.estimating": "Working out the cost…",
	"notes.estimate":
		"Write notes for {files:file} ({pages:page}, {images:imagePage}): about {cost} with {model}.",
	"notes.costUnknown": "an unknown cost",
	"notes.write": "Write the notes",
	"notes.noKeyHint":
		"Save a key, or prepare a job folder for your own AI tool below.",
	"notes.starting": "Starting…",
	"notes.progress": "Writing note {done} of {total}…",
	"notes.wrote": "Wrote {n:note}.",
	"notes.stopped": "Wrote {n:note}, then stopped at your spending limit.",
	"notes.failedLine": "{name} failed: {reason}",
	"notes.failedTitle": "Files that were not written",
	"notes.failedMore": "… and {n:file} without a note.",
	"notes.jobTitle": "Write with your own AI tool",
	"notes.jobIntro":
		"The Studio writes a folder with a fixed prompt. Paste the prompt into your tool; it writes the notes into the folder, and you collect them here. The Studio never runs another program.",
	"notes.jobTool": "My AI tool",
	"notes.tool.claude-code": "Claude Code",
	"notes.tool.other": "Another AI tool",
	"notes.prepare": "Prepare a job for my AI tool",
	"notes.preparing": "Preparing…",
	"notes.jobReady": "The job is ready for {n:file}.",
	"notes.promptHint": "The job folder is {path}. Paste this into your tool:",
	"notes.copy": "Copy the prompt",
	"notes.copied": "Copied.",
	"notes.jobs": "Jobs",
	"notes.jobsNone": "No job yet.",
	"notes.jobLine": "{created} · {tool} · {files:file}",
	"notes.collect": "Collect the notes",
	"notes.collecting": "Collecting…",
	"notes.collected": "Kept: {n:note}.",
	"notes.collectedSkipped":
		"Kept: {n:note}. Skipped, already kept: {skipped:note}.",
	"notes.deleteJob": "Delete",
	"notes.refusal.name": "not a note of this job (the name must be <id>.md)",
	"notes.refusal.link": "it is a link, not a file",
	"notes.refusal.notFile": "it is not a regular file",
	"notes.refusal.unknown": "this file is not in the job",
	"notes.refusal.noFirstPart": "the first part is missing",
	"notes.refusal.tooLarge": "it is over 300 KB",
	"notes.refusal.notUtf8": "it is not UTF-8 text",
	"notes.refusal.unusable":
		"it is not a usable note (too short, or no “## What it covers”)",
	"notes.refusal.other": "it was refused",
	"notes.fileTitle": "The note",
	"notes.noNote": "No note for this file yet.",
	"notes.writeAgain": "Write again",
	"notes.rewriteConfirm":
		"Write this file's note again, and replace the one there? About {cost}.",
	"notes.rewriteDone": "The note is written again.",
	"failure.noKey":
		"No OpenRouter key is set on this computer. Save one in the Notes tab, or use a job folder.",
	"failure.noStorage":
		"This computer has no secure store for a key. Use the job folder way instead.",
	"failure.noCredit":
		"The OpenRouter account has no credit. Add credit, or use a job folder.",
	"failure.refused":
		"OpenRouter refused the request. Try again, or use a job folder.",
	"failure.limit":
		"The spending limit stopped the run. Raise the limit or write fewer files.",

	// The Changes tab (task 158).
	"project.tab.changes": "Changes to review",
	"changes.title": "Changes to review",
	"changes.intro":
		"AI proposes the units, lessons, skills, key words, evidence and facts of one period, from the notes of that period's files. Accept all of it, or one unit or lesson at a time. Nothing changes until you accept it.",
	"changes.settings": "The model and the limit",
	"changes.model": "Model",
	"changes.limit": "The limit for one change set (US dollars)",
	"changes.saveSettings": "Save",
	"changes.targets": "Course periods",
	"changes.targetLine":
		"{units:unit} · {lessons:lesson} · {files:file} · {notes} with a note",
	"changes.pending": "a change set is waiting",
	"changes.plan": "{units:unit} and {notes:note}: about {cost} with {model}.",
	"changes.noPrice":
		"The model's price is not known, so the cost cannot be shown.",
	"changes.write": "Write with my key",
	"changes.confirmWrite": "Write it",
	"changes.writing": "Writing the change set…",
	"changes.wrote": "The change set is ready to review.",
	"changes.noKeyHint":
		"Save a key in the Notes tab, or prepare a job for your own AI tool below.",
	"changes.pickHint": "Tick the periods to put in one job folder.",
	"changes.jobTitle": "With my AI tool",
	"changes.jobIntro":
		"The Studio writes a folder with a fixed prompt. Paste it into your tool; it writes one change set per course folder, and you collect them here. The Studio never drives another program.",
	"changes.prepare": "Prepare a job for my AI tool",
	"changes.preparing": "Preparing…",
	"changes.jobReady": "The job is ready for {n:courseFolder}.",
	"changes.collect": "Collect the change sets",
	"changes.collecting": "Collecting…",
	"changes.saving": "Saving…",
	"changes.collected": "Collected: {n:changeSet}.",
	"changes.collectedSkipped":
		"Collected: {n:changeSet}. Skipped, already waiting: {skipped:changeSet}.",
	"changes.jobs": "Jobs",
	"changes.jobsNone": "No job yet.",
	"changes.jobLine": "{created} · {tool} · {n:courseFolder}",
	"changes.review": "Waiting for review",
	"changes.none": "No change set is waiting.",
	"changes.now": "Now",
	"changes.proposed": "Proposed",
	"changes.unit": "Unit {number}",
	"changes.lesson": "Lesson {number}",
	"changes.keywords": "Key words",
	"changes.evidence": "Evidence",
	"changes.skills": "Skills",
	"changes.facts": "Facts",
	"changes.acceptAll": "Accept all",
	"changes.acceptUnit": "Accept this unit",
	"changes.acceptLesson": "Accept this lesson",
	"changes.reject": "Reject",
	"changes.accepted": "accepted",
	"changes.newFacts": "New facts: {n}",
	"changes.removedFacts": "Removed facts: {n}",
	"changes.pageFailed": "page check failed",
	"changes.copiedRun": "copied from the page: “{run}”",
	"changes.open": "Open questions",
	"changes.refused": "Refused items",
	"changes.rejected": "Rejected sets",
	"changes.deleteSet": "Delete",
	"changes.rejectedLine": "{at} · {model}",
	"changes.from.key": "written with your key",
	"changes.from.job": "from a job folder",
	"changes.refusal.name": "not a folder of this job",
	"changes.refusal.link": "a link, not a file",
	"changes.refusal.notFile": "not a regular file",
	"changes.refusal.unknown": "that course and period is not in the project",
	"changes.refusal.tooLarge": "2 MB or larger",
	"changes.refusal.notUtf8": "not UTF-8 text",
	"changes.refusal.invalid": "not a change set this project can review",
	"changes.refusal.other": "refused",

	// The exams step (task 177).
	"changes.exams": "Exams",
	"changes.examTargets": "Courses with exam papers",
	"changes.examTargetsNone":
		"No course has an exam paper or mark scheme with a note yet.",
	"changes.examTargetLine": "{exams:exam} · {files:file} · {notes:note}",
	"changes.examYears": "Older years left out: {years}",
	"changes.examPlan":
		"{exams:exam} and {notes:note}: about {cost} with {model}.",
	"changes.examJobTitle": "Exam papers with my AI tool",
	"changes.examJobIntro":
		"Prepare one folder per course with its exam notes, then collect the exam change sets your tool writes.",
	"changes.examPrepare": "Prepare an exams job",
	"changes.examJobReady": "The exams job is ready for {n:courseFolder}.",
	"changes.examWrite": "Write the exams with my key",
	"changes.examPickHint": "Tick the courses to put in one exams job.",
	"changes.examsNone": "No exam change set is waiting.",
	"changes.paper": "Paper: {name}",
	"changes.part": "Part: {name}",
	"changes.changedFields": "Changed fields",
	"changes.added": "added",
	"changes.removed": "removed",
	"changes.acceptPaper": "Accept this paper",
	"changes.sources": "Read from",

	// The numbers an exam states about the same thing (task 192).
	"examNumbers.summary": "Numbers that don't add up: {n:number}.",
	"examNumbers.fix": "Fix",
	"examNumbers.count-types": "{sum:question} typed, but the count is {count}",
	"examNumbers.total-each":
		"marksEach {each} × {count} is not totalMarks {total}",
	"examNumbers.total-by-type":
		"the types are worth {sum}, not totalMarks {total}",
	"examNumbers.part-total":
		"the part's marks {marks} are not its totalMarks {total}",
	"examNumbers.paper-parts":
		"the paper's marks {marks} are not the sum of its parts ({sum})",
	"examNumbers.choice-options":
		"choiceOptions are set, but no question is choice or multi",
	"examNumbers.max-answer-words":
		"maxWords {max} is under the shortest answer ({shortest})",
	"examNumbers.both-mark-forms":
		"marksEach {each} and marksByType {type} {marks} disagree",

	// A new course or a block with no unit yet (task 178).
	"changes.newCourse": "new course",
	"changes.newBlock": "new block",

	// A file's details: what the register guessed, and the author may correct.
	"detail.title": "The file's details",
	"detail.hint":
		"What you change here is kept when the project is looked at again.",
	"detail.block": "Block",
	"detail.kind": "Kind",
	"detail.authority": "Authority",
	"detail.authorityNone": "Not known",
	"detail.save": "Save",
	"kind.mark-scheme": "mark scheme",
	"kind.exam": "exam",
	"kind.revision": "revision",
	"kind.homework": "homework",
	"kind.worksheet": "worksheet",
	"kind.sheet": "sheet",
	"kind.book": "book",
	"kind.other": "other",
	"authority.1": "official",
	"authority.2": "the school",
	"authority.3": "summaries and revisions",
	"authority.4": "third party",

	// The New material panel.
	"new.title": "New material",
	"new.intro":
		"Files you copy into the project's folders are found here. Nothing is moved: the Studio reads them and keeps what it read in .studio.",
	"new.scan": "Look for new material",
	"new.stop": "Stop",
	"new.starting": "Looking…",
	"new.reading": "Looking in the folders… {found:file}, {read} read",
	"new.pictures": "Drawing the pages that are pictures… {done} of {pages}",
	"new.ocr": "Reading the picture pages… {done} of {pages}",
	"new.finished": "Finished: {done} of {pages:page} read.",
	"new.firstScan": "The first look.",
	"new.since": "Since {since}.",
	"new.counts": "{found:file} · {read} read · {new} new",
	"new.emptyFirst": "Nothing new on the first look.",
	"new.none": "Nothing new since {since}.",
	"new.ocrPages": "Read the text of {n:imagePage}.",
	"new.allRead": "All files are read ({n:file}).",
	"new.showFiles": "Show the files",
	"new.noGrade": "no grade",
	"new.noSubject": "no subject",
	"new.noBlock": "no block",
	"new.block": "Block {block}",
	"new.year.none": "no year",
	"new.noDate": "no date",
	"new.authority": "authority {n}",
	"new.pages": "{n:page} ({images} from pictures)",
	"new.affected": "The units it touches",
	"new.affected.noCourse": "No course for this grade and subject yet.",
	"new.affected.noUnit": "No unit for block {block}.",
	"new.affected.unit": "Unit {number}: {title} ({source})",
	"new.affected.confirm":
		"this year's sheet arrived: the unit can be confirmed",
	"new.source.sheet": "from a sheet",
	"new.source.provisional": "predicted",
	"new.look": "Needs a look",
	"new.look.none": "Nothing needs a look.",
	"new.why.noSubject": "no subject (add its folder to _subjects.csv)",
	"new.why.noGrade": "no grade",
	"new.why.error": "error: {detail}",
	"new.why.copy": "a copy of {id}",
	"new.copies": "Copied: {n:file}",
	"new.moved": "Moved: {n:file}",
	"new.removed": "Removed from the folders: {n:file}",
	"new.tessdata":
		"Some pages are pictures the Studio could not read. Reinstall the Studio to fix this.",
	"new.nothingYet": "Nothing has been looked for yet.",
	"toast.scanned": "Looked for new material.",
	"toast.saved": "Saved.",
	"toast.stopped": "Stopped.",

	"common.cancel": "Cancel",
	"common.ok": "OK",
	"common.close": "Close",
};

export type TextKey = keyof typeof en;

const ar: Record<TextKey, string> = {
	"app.name": "استوديو مستر زكي",
	"app.tagline": "حوِّل موادّك إلى منهج دراسي.",
	"app.language": "اللغة",
	"app.startScreen": "شاشة البداية",

	"start.new": "منهج جديد",
	"start.newHint": "سمِّه، واختر الصفوف والمواد، وتُنشأ المجلدات لك.",
	"start.open": "افتح مجلدًا",
	"start.openHint": "افتح مشروعًا أنشأته من قبل، أو مجلدًا فيه مواد.",
	"start.recent": "المشروعات الأخيرة",
	"start.recentEmpty": "لا شيء بعد. ستظهر هنا المشروعات التي تفتحها.",
	"start.recentMissing": "هذا المجلد لم يعد موجودًا.",
	"start.adopt": "افتح موادّي الحالية",
	"start.adoptHint":
		"اجمع موادًّا أعددتَها من قبل، والعمل الذي تمّ عليها، والمنهج المبنيّ منها، في مشروع واحد.",

	"wizard.step": "الخطوة {n} من 3",
	"wizard.next": "التالي",
	"wizard.back": "السابق",
	"wizard.create": "أنشئ المجلدات",
	"wizard.cancel": "إلغاء",
	"wizard.creating": "جارٍ الإنشاء…",
	"wizard.name.title": "ما اسم هذا المنهج؟",
	"wizard.name.nameEn": "الاسم بالإنجليزية",
	"wizard.name.nameAr": "الاسم بالعربية",
	"wizard.name.author": "المؤلف",
	"wizard.name.rights": "حقوق الاستخدام",
	"wizard.name.rightsHint":
		"جملة يقرأها ولي الأمر قبل الاستيراد، مثل: «لطلابي فقط».",
	"wizard.name.fix": "صحِّح الحقول المعلَّمة.",
	"wizard.grades.title": "أي صفوف ومواد؟",
	"wizard.grades.hint": "اختر الصفوف، ثم المواد التي تتبع كل صف.",
	"wizard.grades.subjects": "{n:subject}",
	"wizard.grades.fix": "اختر صفًا واحدًا ومادة واحدة على الأقل.",
	"wizard.year.title": "كيف تُقسَّم السنة؟",
	"wizard.year.hint": "كل وحدة تتبع جزءًا من السنة. والأسماء لك تغييرها.",
	"wizard.year.finalExam": "أضف اختبارًا نهائيًا يشمل السنة كلها",
	"wizard.year.fix": "اكتب اسم كل جزء بالعربية والإنجليزية.",
	"wizard.preset.terms-blocks": "3 فصول × مرحلتين",
	"wizard.preset.semesters": "فصلان دراسيان",
	"wizard.preset.terms": "3 فصول دراسية",
	"wizard.preset.quarters": "4 أرباع دراسية",
	"wizard.preset.none": "بلا تقسيم",
	"wizard.period.nameEn": "الاسم بالإنجليزية",
	"wizard.period.nameAr": "الاسم بالعربية",
	"wizard.folders.title": "ستُنشأ هذه المجلدات",
	"wizard.folders.hint": "داخل {root}",

	"project.inbox": "الوارد",
	"project.inboxCount": "{n} للترتيب",
	"project.inboxEmpty":
		"لا شيء للترتيب. الملفات التي تُسقطها هنا تنتظر حتى تضعها.",
	"project.newUnit": "وحدة جديدة",
	"project.rename": "إعادة تسمية",
	"project.delete": "حذف",
	"project.moveTo": "انقل إلى…",
	"project.move": "انقل",
	"project.grade": "الصف",
	"project.subject": "المادة",
	"project.section": "القسم",
	"project.unit": "الوحدة",
	"project.choose": "اختر…",
	"project.section.Units": "الوحدات",
	"project.section.Books": "الكتب",
	"project.section.Extra": "إضافي",
	"project.section.Exam": "الاختبار",
	"project.dropHere": "أفلِت الأوراق هنا",
	"project.dropHint": "أو الصق بـ Ctrl+V. تُنسخ الملفات ولا تُنقل.",
	"project.pickFile": "اختر ملفًا لعرضه هنا.",
	"project.pickFolder": "اختر مجلدًا من الشجرة لإفلات الملفات فيه.",
	"project.empty": "هذا المجلد فارغ.",
	"project.files": "{n:file}",
	"project.tab.files": "الملفات",
	"project.tab.curriculum": "المنهج",
	"project.export": "صدِّر المنهج…",

	"curriculum.loading": "جارٍ قراءة المنهج…",
	"language.title": "اللغة والمساعدة",
	"language.teaching": "لغة التدريس",
	"language.help": "المساعدة بلغة",
	"language.helpHint":
		"يجوز للسيد زكي أن يشرح بهذه اللغات حين يتعثر الطفل، ويفهم الطفل إذا كتب بها.",
	"language.changeWarn":
		"يعدّ السيد زكي المقرر بلغة أخرى مقررًا مختلفًا، فلا ينتقل إليه تقدّم الأطفال. هل تغيّرها؟",
	"language.notYet":
		"لا يستطيع السيد زكي التدريس بـ{language} بعد. سيرى الأهل هذا المقرر غير متاح حتى يستطيع.",
	"language.helpNotYet":
		"لا يستطيع السيد زكي المساعدة بـ{language} بعد، ويعمل المقرر بدونها.",
	"language.applyOthers": "طبّق المساعدة على صفوف أخرى…",
	"language.applyHint":
		"تأخذ المادةُ نفسها في الصفوف التي تختارها لغاتِ المساعدة هذه.",
	"language.apply": "طبّق",
	"language.noOthers": "لا يوجد صف آخر فيه هذه المادة.",
	"language.saved": "تم الحفظ.",
	"language.addOther": "أضف بلغة أخرى…",
	"language.addHint":
		"المادة نفسها تُدرَّس بلغة أخرى. تبقى فارغة حتى تعطيها ملفات.",
	"language.add": "أضف",
	"language.addNone": "لهذه المادة جميع اللغات بالفعل.",
	"language.added":
		"أُضيفت {subject} باللغة {language}. أعطها ملفات في تبويب الملفات؛ وستظهر هنا بعد أول تعديل مُعتمد.",
	"wizard.language": "تُدرَّس معظم مواد هذا المنهج باللغة",
	"wizard.languageHint":
		"تُدرَّس مواد اللغات بلغتها. يمكنك تغيير لغة أي مقرر لاحقًا من تبويب المنهج.",
	"export.languageWarn": "{course}: {text}",
	"curriculum.empty":
		"لا وحدات بعد. اكتب ملاحظات ملفاتك في «الملاحظات»، ثم اقترح الوحدات في «تغييرات للمراجعة».",
	"curriculum.units": "الوحدات",
	"curriculum.period": "المرحلة",
	"curriculum.skills": "المهارات",
	"curriculum.facts": "الحقائق",
	"curriculum.noFacts": "لا توجد حقائق في هذا الدرس.",
	"curriculum.exams": "الاختبارات",
	"curriculum.examStyle": "أسلوب الاختبار",
	"curriculum.source": "من أين جاءت",
	"curriculum.noPage": "من ملف المنهج، بلا صفحة",
	"start.bundle": "افتح ملف منهج",
	"start.bundleHint":
		"أنشئ مشروعًا من ملف ‎.zaki، ثم أضف صفًا أو فترة أو مواد أكثر.",
	"bundle.title": "فتح ملف منهج",
	"bundle.invalid": "لا يمكن فتح هذا الملف:",
	"bundle.author": "إعداد {name}",
	"bundle.rights": "حقوقه:",
	"bundle.agree": "يحق لي تعديل هذا المنهج (انظر حقوقه أعلاه).",
	"bundle.hint":
		"بعد ذلك اختر مجلدًا فارغًا: يُنشأ فيه المشروع، ويكون تصديره التالي تحديثًا لهذا المنهج.",
	"bundle.make": "اختر مجلدًا وأنشئ المشروع…",
	"curriculum.pickFact": "اختر صفحة حقيقة لعرضها هنا.",
	"curriculum.pageText": "نص الصفحة",
	"curriculum.noPageText": "لم يُقرأ نصّ من هذه الصفحة.",
	"curriculum.fileMissing": "هذا الملف لم يعد في المشروع.",
	"curriculum.factCount": "{n:fact}",
	"curriculum.lessonCount": "{n:lesson}",
	"curriculum.hideSource": "أخفِ المصدر",
	"curriculum.showSource": "أظهر المصدر",

	"panes.grades": "الحدّ بين الصفوف والدرس",
	"panes.source": "الحدّ بين الدرس ومن أين جاءت",
	"panes.tree": "الحدّ بين الشجرة والملف",
	"panes.hint":
		"اسحبه، أو استخدم السهمين الأيمن والأيسر. انقر نقرًا مزدوجًا للرجوع.",

	"export.title": "تصدير المنهج",
	"export.summary": "سيكون في هذا الملف:",
	"export.courses": "{n:course}",
	"export.units": "{n:unit}",
	"export.lessons": "{n:lesson}",
	"export.facts": "{n:fact}",
	"export.exams": "{n:exam}",
	"export.version": "الإصدار {n}",
	"export.author": "اسمك، بصفتك المؤلف",
	"export.rights": "جملة الحقوق التي يقرأها ولي الأمر قبل الاستيراد",
	"export.change": "غيّر",
	"export.save": "اختر مكان الحفظ…",
	"export.done": "صُدِّر الإصدار {n} في ملف ‎.zaki.",
	"export.copy": "تُحفظ نسخة في هذا المشروع.",
	"export.problems": "لم يُكتب شيء. هذه المشكلات تمنع الملف:",
	"export.working": "جارٍ فحص الملف…",
	"export.examWarnings":
		"أرقام في الامتحانات لا تتطابق: {n:number}. والتصدير يعمل.",
	"export.examWarningCourse": "{course} · {n}",
	"export.openExamCourse": "افتح المقرر",

	"viewer.page": "الصفحة {n} من {total}",
	"viewer.previous": "الصفحة السابقة",
	"viewer.next": "الصفحة التالية",
	"viewer.zoomIn": "أكبر",
	"viewer.zoomOut": "أصغر",
	"viewer.wordNote": "نص ملف وورد بترتيبه، دون تنسيقه.",
	"viewer.openInApp": "افتحه في تطبيقه",
	"viewer.openHint": "لا يوجد عارض لهذا الملف هنا بعد.",
	"viewer.audio": "صوت",
	"viewer.pdfFailed": "تعذّر فتح ملف PDF هذا.",
	"viewer.imageFailed": "تعذّر فتح هذه الصورة.",
	"viewer.textFailed": "تعذّرت قراءة هذا الملف نصًّا.",
	"viewer.loading": "جارٍ القراءة…",
	"viewer.noText": "لا يوجد نص في ملف وورد هذا.",

	"toast.added": "المضاف: {n:file}.",
	"toast.addedSkipped": "المضاف: {n:file}، والمتخطّى: {skipped:file}.",
	"toast.moved": "نُقل.",
	"toast.renamed": "أُعيدت التسمية.",
	"toast.deleted": "نُقل إلى سلة المحذوفات.",
	"toast.pasted": "أُلصق.",
	"toast.unitMade": "أُنشئت وحدة جديدة.",
	"toast.alreadyProject": "هذا المجلد مشروع من قبل. فُتح.",
	"prompt.renameTitle": "إعادة تسمية",
	"prompt.unitTitle": "اسم الوحدة الجديدة",
	"prompt.unitHint": "يُرقَّم لك: «03 الطاقة» بعد «02 الخلايا».",
	"prompt.placeholder": "الاسم",

	"failure.outside": "هذا المسار خارج المشروع. اختر مسارًا داخله.",
	"failure.notOpen": "هذا المجلد غير مفتوح في الاستوديو. افتح المشروع من جديد.",
	"failure.missing":
		"هذا الملف أو المجلد لم يعد موجودًا. ابحث عن مواد جديدة لتحديث القائمة.",
	"failure.tooLarge": "هذا الملف أكبر من أن يُعرض هنا. افتحه في تطبيقه.",
	"failure.unreadable":
		"تعذّرت قراءة هذا الملف. أغلقه إن كان مفتوحًا في برنامج آخر، ثم حاول مرة أخرى.",
	"failure.nameTaken": "هذا الاسم مستخدم في هذا المجلد. اختر اسمًا آخر.",
	"failure.invalidName": "هذا الاسم غير مسموح في ويندوز. اختر اسمًا آخر.",
	"failure.invalidProject":
		"ملف curriculum.json في هذا المجلد ليس مشروع استوديو. افتح مجلدًا آخر.",
	"failure.noWork":
		"لا يوجد مجلد _work بجانب هذه المواد. اختر المجلد الذي يحويه.",
	"failure.emptyModel":
		"لا يوجد منهج في هذا المشروع لتصديره بعد. أضف مقررًا أولًا.",
	"failure.invalidBundle": "لم يجتز الملف الفحص. افتحه مرة أخرى لتعرف السبب.",
	"failure.notEmpty": "اختر مجلدًا فارغًا للمشروع الجديد.",
	"failure.unknown":
		"حدث خطأ ما. حاول مرة أخرى، وإن تكرر فأعد تشغيل الاستوديو.",
	"failure.cancelled": "",

	"project.tab.new": "مواد جديدة",
	"project.look": "ابحث عن مواد جديدة",
	"project.putInFolder": "ضع في مجلد…",
	"project.putHint": "أي مجلد في المشروع، حتى المجلدات التي رتّبتها بنفسك.",
	"project.folder": "المجلد",
	"project.put": "ضع هنا",

	// تبويب الملاحظات (مهمة 157).
	"project.tab.notes": "الملاحظات",
	"notes.title": "الملاحظات",
	"notes.intro":
		"ملاحظة دراسية واحدة لكل ملف، يكتبها الذكاء الاصطناعي من نص الملف ومن صفحاته المصوّرة التي لم تُقرأ. استخدم مفتاحك، أو جهّز مجلدًا لأداة الذكاء الاصطناعي التي تستخدمها.",
	"notes.settings": "مفتاحك والنموذج",
	"notes.model": "النموذج",
	"notes.limit": "حدّ الإنفاق لهذه المرة (دولار)",
	"notes.saveSettings": "احفظ",
	"notes.saved": "حُفظ.",
	"notes.key": "مفتاح OpenRouter",
	"notes.keyPlaceholder": "ألصق المفتاح هنا",
	"notes.keyHint":
		"يُحفظ المفتاح مشفّرًا على هذا الحاسوب، ولا يُحفظ في المشروع أبدًا.",
	"notes.keySet": "هناك مفتاح محفوظ على هذا الحاسوب.",
	"notes.keyMissing": "لا يوجد مفتاح بعد.",
	"notes.saveKey": "احفظ المفتاح",
	"notes.clearKey": "انسَ المفتاح",
	"notes.testKey": "اختبر المفتاح",
	"notes.testing": "جارٍ اختبار المفتاح…",
	"notes.testOk": "المفتاح يعمل.",
	"notes.keySaved": "حُفظ المفتاح على هذا الحاسوب.",
	"notes.keyCleared": "نُسي المفتاح.",
	"notes.noVision":
		"هذا النموذج لا يقرأ الصور، لذلك تُرسل الصفحات المصوّرة نصًّا من التعرّف الضوئي فقط.",
	"notes.unknownModel":
		"قائمة OpenRouter لا تعرف هذا النموذج، وسعره غير معروف.",
	"notes.files": "الملفات",
	"notes.onlyMissing": "الملفات التي بلا ملاحظة فقط",
	"notes.filterGrade": "الصف",
	"notes.filterSubject": "المادة",
	"notes.filterBlock": "المرحلة",
	"notes.filterYear": "السنة الدراسية",
	"notes.filterKind": "النوع",
	"notes.allGrades": "كل الصفوف",
	"notes.allSubjects": "كل المواد",
	"notes.noneMatch": "لا يوجد ملف يطابق هذا التصفية.",
	"notes.chosenHint": "يشمل العدد كل ملف يخفيه التصفية.",
	"notes.tickShown": "تحديد كل المعروض ({n})",
	"notes.untickShown": "إلغاء تحديد كل المعروض",
	"notes.none": "لكل ملف ملاحظة.",
	"notes.chosen": "المختار: {n:file}",
	"notes.pages": "{n:page}",
	"notes.estimating": "جارٍ حساب الكلفة…",
	"notes.estimate":
		"كتابة الملاحظات لـ{files:file} ({pages:page}، و{images:imagePage}): نحو {cost} بالنموذج {model}.",
	"notes.costUnknown": "كلفة غير معروفة",
	"notes.write": "اكتب الملاحظات",
	"notes.noKeyHint": "احفظ مفتاحًا، أو جهّز مجلد عمل لأداتك في الأسفل.",
	"notes.starting": "جارٍ البدء…",
	"notes.progress": "جارٍ كتابة الملاحظة {done} من {total}…",
	"notes.wrote": "المكتوب: {n:note}.",
	"notes.stopped": "المكتوب: {n:note}، ثم توقّف عند حدّ الإنفاق.",
	"notes.failedLine": "فشل {name}: {reason}",
	"notes.failedTitle": "ملفات لم تُكتب",
	"notes.failedMore": "… و{n:file} بلا ملاحظة.",
	"notes.jobTitle": "الكتابة بأداتك",
	"notes.jobIntro":
		"يكتب الاستوديو مجلدًا فيه طلب ثابت. ألصق الطلب في أداتك؛ تكتب الملاحظات في المجلد، ثم تجمعها هنا. ولا يشغّل الاستوديو برنامجًا آخر.",
	"notes.jobTool": "أداتي",
	"notes.tool.claude-code": "Claude Code",
	"notes.tool.other": "أداة أخرى",
	"notes.prepare": "جهّز عملًا لأداتي",
	"notes.preparing": "جارٍ التجهيز…",
	"notes.jobReady": "العمل جاهز لـ{n:file}.",
	"notes.promptHint": "مجلد العمل هو {path}. ألصق هذا في أداتك:",
	"notes.copy": "انسخ الطلب",
	"notes.copied": "نُسخ.",
	"notes.jobs": "الأعمال",
	"notes.jobsNone": "لا يوجد عمل بعد.",
	"notes.jobLine": "{created} · {tool} · {files:file}",
	"notes.collect": "اجمع الملاحظات",
	"notes.collecting": "جارٍ الجمع…",
	"notes.collected": "المحفوظ: {n:note}.",
	"notes.collectedSkipped":
		"المحفوظ: {n:note}. والمتخطّى لأنه محفوظ: {skipped:note}.",
	"notes.deleteJob": "احذف",
	"notes.refusal.name": "ليس ملاحظة لهذا العمل (الاسم <id>.md)",
	"notes.refusal.link": "رابط وليس ملفًا",
	"notes.refusal.notFile": "ليس ملفًا عاديًا",
	"notes.refusal.unknown": "هذا الملف ليس في العمل",
	"notes.refusal.noFirstPart": "الجزء الأول مفقود",
	"notes.refusal.tooLarge": "أكبر من 300 ك.ب",
	"notes.refusal.notUtf8": "ليس نصًّا بترميز UTF-8",
	"notes.refusal.unusable":
		"ليس ملاحظة صالحة (قصيرة، أو بلا «## What it covers»)",
	"notes.refusal.other": "رُفض",
	"notes.fileTitle": "الملاحظة",
	"notes.noNote": "لا ملاحظة لهذا الملف بعد.",
	"notes.writeAgain": "اكتبها مرة أخرى",
	"notes.rewriteConfirm":
		"أأكتب ملاحظة هذا الملف مرة أخرى وأبدّل الموجودة؟ نحو {cost}.",
	"notes.rewriteDone": "كُتبت الملاحظة مرة أخرى.",
	"failure.noKey":
		"لا يوجد مفتاح OpenRouter على هذا الحاسوب. احفظ مفتاحًا في تبويب الملاحظات، أو استخدم مجلد عمل.",
	"failure.noStorage":
		"لا يوجد مخزن آمن للمفتاح على هذا الحاسوب. استخدم طريقة مجلد العمل بدلًا منه.",
	"failure.noCredit":
		"لا يوجد رصيد في حساب OpenRouter. أضف رصيدًا، أو استخدم مجلد عمل.",
	"failure.refused": "رفض OpenRouter الطلب. حاول مرة أخرى، أو استخدم مجلد عمل.",
	"failure.limit": "أوقف حدّ الإنفاق الكتابة. ارفع الحدّ أو اكتب ملفات أقل.",

	// تبويب التغييرات (المهمة 158).
	"project.tab.changes": "تغييرات للمراجعة",
	"changes.title": "تغييرات للمراجعة",
	"changes.intro":
		"يقترح الذكاء الاصطناعي وحدات مرحلة واحدة ودروسها ومهاراتها وكلماتها المفتاحية وأدلّتها وحقائقها، من ملاحظات ملفات تلك المرحلة. اقبلها كلها، أو وحدة أو درسًا واحدًا في كل مرة. ولا يتغيّر شيء قبل أن تقبل.",
	"changes.settings": "النموذج والحدّ",
	"changes.model": "النموذج",
	"changes.limit": "حدّ الإنفاق للتغيير الواحد (دولار)",
	"changes.saveSettings": "احفظ",
	"changes.targets": "مراحل المقررات",
	"changes.targetLine":
		"{units:unit} · {lessons:lesson} · {files:file} · {notes} بملاحظة",
	"changes.pending": "يوجد تغيير ينتظر",
	"changes.plan": "{units:unit} و{notes:note}: نحو {cost} بالنموذج {model}.",
	"changes.noPrice": "سعر النموذج غير معروف، فلا يمكن عرض الكلفة.",
	"changes.write": "اكتب بمفتاحي",
	"changes.confirmWrite": "اكتبه",
	"changes.writing": "جارٍ كتابة التغييرات…",
	"changes.wrote": "التغييرات جاهزة للمراجعة.",
	"changes.noKeyHint":
		"احفظ مفتاحًا في تبويب الملاحظات، أو جهّز عملًا لأداتك في الأسفل.",
	"changes.pickHint": "أشّر المراحل التي تريدها في مجلد عمل واحد.",
	"changes.jobTitle": "بأداتي",
	"changes.jobIntro":
		"يكتب الاستوديو مجلدًا فيه طلب ثابت. ألصق الطلب في أداتك؛ تكتب تغييرات لكل مجلد مقرر، ثم تجمعها هنا. ولا يشغّل الاستوديو برنامجًا آخر.",
	"changes.prepare": "جهّز عملًا لأداتي",
	"changes.preparing": "جارٍ التجهيز…",
	"changes.jobReady": "العمل جاهز لـ{n:courseFolder}.",
	"changes.collect": "اجمع التغييرات",
	"changes.collecting": "جارٍ الجمع…",
	"changes.saving": "جارٍ الحفظ…",
	"changes.collected": "المجمّع: {n:changeSet}.",
	"changes.collectedSkipped":
		"المجمّع: {n:changeSet}. والمتخطّى لأنه ينتظر من قبل: {skipped:changeSet}.",
	"changes.jobs": "الأعمال",
	"changes.jobsNone": "لا يوجد عمل بعد.",
	"changes.jobLine": "{created} · {tool} · {n:courseFolder}",
	"changes.review": "تنتظر المراجعة",
	"changes.none": "لا يوجد تغيير ينتظر.",
	"changes.now": "الحالي",
	"changes.proposed": "المقترح",
	"changes.unit": "الوحدة {number}",
	"changes.lesson": "الدرس {number}",
	"changes.keywords": "الكلمات المفتاحية",
	"changes.evidence": "الأدلّة",
	"changes.skills": "المهارات",
	"changes.facts": "الحقائق",
	"changes.acceptAll": "اقبل الكل",
	"changes.acceptUnit": "اقبل هذه الوحدة",
	"changes.acceptLesson": "اقبل هذا الدرس",
	"changes.reject": "ارفض",
	"changes.accepted": "مقبول",
	"changes.newFacts": "حقائق جديدة: {n}",
	"changes.removedFacts": "حقائق محذوفة: {n}",
	"changes.pageFailed": "فحص الصفحة لم ينجح",
	"changes.copiedRun": "منسوخ من الصفحة: «{run}»",
	"changes.open": "أسئلة مفتوحة",
	"changes.refused": "عناصر مرفوضة",
	"changes.rejected": "تغييرات مرفوضة",
	"changes.deleteSet": "احذف",
	"changes.rejectedLine": "{at} · {model}",
	"changes.from.key": "كُتب بمفتاحك",
	"changes.from.job": "من مجلد عمل",
	"changes.refusal.name": "ليس مجلدًا في هذا العمل",
	"changes.refusal.link": "رابط وليس ملفًا",
	"changes.refusal.notFile": "ليس ملفًا عاديًا",
	"changes.refusal.unknown": "هذا المقرر وهذه المرحلة ليسا في المشروع",
	"changes.refusal.tooLarge": "٢ م.ب أو أكبر",
	"changes.refusal.notUtf8": "ليس نصًّا بترميز UTF-8",
	"changes.refusal.invalid": "ليس تغييرات يستطيع المشروع مراجعتها",
	"changes.refusal.other": "رُفض",

	// The exams step (task 177).
	"changes.exams": "الامتحانات",
	"changes.examTargets": "المواد التي لها أوراق امتحان",
	"changes.examTargetsNone":
		"لا توجد مادة لها ورقة امتحان أو نموذج إجابة بملاحظة بعد.",
	"changes.examTargetLine": "{exams:exam} · {files:file} · {notes:note}",
	"changes.examYears": "السنوات الأقدم المستبعدة: {years}",
	"changes.examPlan": "{exams:exam} و{notes:note}: نحو {cost} مع {model}.",
	"changes.examJobTitle": "أوراق الامتحان بأداتي",
	"changes.examJobIntro":
		"جهّز مجلدًا لكل مادة مع ملاحظات امتحاناتها، ثم اجمع تغييرات الامتحانات التي تكتبها أداتك.",
	"changes.examPrepare": "جهّز مهمة امتحانات",
	"changes.examJobReady": "مهمة الامتحانات جاهزة لـ{n:courseFolder}.",
	"changes.examWrite": "اكتب الامتحانات بمفتاحي",
	"changes.examPickHint": "علّم المواد التي تريد وضعها في مهمة امتحانات واحدة.",
	"changes.examsNone": "لا يوجد تغيير امتحان في الانتظار.",
	"changes.paper": "الورقة: {name}",
	"changes.part": "الجزء: {name}",
	"changes.changedFields": "الحقول المتغيرة",
	"changes.added": "مضاف",
	"changes.removed": "محذوف",
	"changes.acceptPaper": "اقبل هذه الورقة",
	"changes.sources": "مقروء من",

	// أرقام الامتحان التي تصف الشيء نفسه (مهمة 192).
	"examNumbers.summary": "أرقام لا تتطابق: {n:number}.",
	"examNumbers.fix": "صحِّح",
	"examNumbers.count-types": "{sum:question} محدَّدة الأنواع، لكن العدد {count}",
	"examNumbers.total-each":
		"marksEach {each} × {count} لا يساوي totalMarks {total}",
	"examNumbers.total-by-type": "الأنواع تساوي {sum}، لا totalMarks {total}",
	"examNumbers.part-total": "علامات الجزء {marks} لا تساوي totalMarks {total}",
	"examNumbers.paper-parts":
		"علامات الورقة {marks} لا تساوي مجموع أجزائها ({sum})",
	"examNumbers.choice-options":
		"خيارات الاختيار محدَّدة، ولا سؤال choice أو multi",
	"examNumbers.max-answer-words":
		"maxWords {max} أقل من أقصر إجابة ({shortest})",
	"examNumbers.both-mark-forms":
		"marksEach {each} و marksByType {type} {marks} لا يتفقان",

	// مقرر جديد أو مرحلة بلا وحدة بعد (مهمة 178).
	"changes.newCourse": "مقرر جديد",
	"changes.newBlock": "مرحلة جديدة",

	"detail.title": "بيانات الملف",
	"detail.hint": "ما تغيّره هنا يبقى عند فحص المشروع مرة أخرى.",
	"detail.block": "المرحلة",
	"detail.kind": "النوع",
	"detail.authority": "الجهة",
	"detail.authorityNone": "غير معروفة",
	"detail.save": "احفظ",
	"kind.mark-scheme": "نموذج إجابة",
	"kind.exam": "امتحان",
	"kind.revision": "مراجعة",
	"kind.homework": "واجب",
	"kind.worksheet": "ورقة عمل",
	"kind.sheet": "مذكرة",
	"kind.book": "كتاب",
	"kind.other": "أخرى",
	"authority.1": "رسمي",
	"authority.2": "المدرسة",
	"authority.3": "ملخصات ومراجعات",
	"authority.4": "طرف ثالث",

	"new.title": "مواد جديدة",
	"new.intro":
		"الملفات التي تنسخها إلى مجلدات المشروع تظهر هنا. لا يُنقل شيء: يقرأها الاستوديو ويحفظ ما قرأه في ‎.studio.",
	"new.scan": "ابحث عن مواد جديدة",
	"new.stop": "أوقف",
	"new.starting": "جارٍ البحث…",
	"new.reading": "جارٍ النظر في المجلدات… {found:file}، قُرئ {read}",
	"new.pictures": "جارٍ رسم الصفحات المصوّرة… {done} من {pages}",
	"new.ocr": "جارٍ قراءة الصفحات المصوّرة… {done} من {pages}",
	"new.finished": "انتهى: {done} من {pages:page}.",
	"new.firstScan": "أول فحص.",
	"new.since": "منذ {since}.",
	"new.counts": "{found:file} · قُرئ {read} · الجديد {new}",
	"new.emptyFirst": "لا شيء جديد في أول فحص.",
	"new.none": "لا شيء جديد منذ {since}.",
	"new.ocrPages": "قُرئ نص {n:imagePage}.",
	"new.allRead": "كل الملفات مقروءة ({n:file}).",
	"new.showFiles": "اعرض الملفات",
	"new.noGrade": "بلا صف",
	"new.noSubject": "بلا مادة",
	"new.noBlock": "بلا مرحلة",
	"new.block": "المرحلة {block}",
	"new.year.none": "بلا سنة",
	"new.noDate": "بلا تاريخ",
	"new.authority": "الجهة {n}",
	"new.pages": "{n:page} ({images} من الصور)",
	"new.affected": "الوحدات المتأثرة",
	"new.affected.noCourse": "لا يوجد مقرر لهذا الصف وهذه المادة بعد.",
	"new.affected.noUnit": "لا توجد وحدة للمرحلة {block}.",
	"new.affected.unit": "الوحدة {number}: {title} ({source})",
	"new.affected.confirm": "وصلت مذكرة هذا العام: يمكن تأكيد الوحدة",
	"new.source.sheet": "من مذكرة",
	"new.source.provisional": "متوقّعة",
	"new.look": "تحتاج نظرة",
	"new.look.none": "لا شيء يحتاج نظرة.",
	"new.why.noSubject": "بلا مادة (أضف مجلدها إلى _subjects.csv)",
	"new.why.noGrade": "بلا صف",
	"new.why.error": "خطأ: {detail}",
	"new.why.copy": "نسخة من {id}",
	"new.copies": "نُسخ: {n:file}",
	"new.moved": "نُقل: {n:file}",
	"new.removed": "حُذف من المجلدات: {n:file}",
	"new.tessdata":
		"بعض الصفحات صور لم يستطع الاستوديو قراءتها. أعد تثبيت الاستوديو لإصلاح ذلك.",
	"new.nothingYet": "لم يُجرَ فحص بعد.",
	"toast.scanned": "بحث عن مواد جديدة.",
	"toast.saved": "حُفظ.",
	"toast.stopped": "أُوقف.",

	"common.cancel": "إلغاء",
	"common.ok": "حسنًا",
	"common.close": "إغلاق",
};

/** Every text, in both languages, under the same keys. */
export const studioText: {
	en: Record<TextKey, string>;
	ar: Record<TextKey, string>;
} = {
	en,
	ar,
};

/** A noun's forms for counting: English one/other; Arabic by Intl.PluralRules("ar"). */
type Counted = {
	en: { one: string; other: string };
	ar: {
		zero: string;
		one: string;
		two: string;
		few: string;
		many: string;
		other: string;
	};
};

/** Every noun a count string may put a number before. */
type Noun =
	| "file"
	| "page"
	| "note"
	| "unit"
	| "lesson"
	| "fact"
	| "course"
	| "exam"
	| "skill"
	| "courseFolder"
	| "changeSet"
	| "paper"
	| "question"
	| "imagePage"
	| "number"
	| "subject";

/**
 * Each noun's forms for counting, with "#" where the digits go. Arabic uses the six forms
 * Intl.PluralRules("ar") names: zero, one, two, few (3–10, 103–110 …), many (11–99, 111–199 …)
 * and other (100, 101, 102 …).
 */
const countedNouns: Record<Noun, Counted> = {
	file: {
		en: { one: "1 file", other: "# files" },
		ar: {
			zero: "لا ملفات",
			one: "ملف واحد",
			two: "ملفان",
			few: "# ملفات",
			many: "# ملفًا",
			other: "# ملف",
		},
	},
	page: {
		en: { one: "1 page", other: "# pages" },
		ar: {
			zero: "لا صفحات",
			one: "صفحة واحدة",
			two: "صفحتان",
			few: "# صفحات",
			many: "# صفحة",
			other: "# صفحة",
		},
	},
	note: {
		en: { one: "1 note", other: "# notes" },
		ar: {
			zero: "لا ملاحظات",
			one: "ملاحظة واحدة",
			two: "ملاحظتان",
			few: "# ملاحظات",
			many: "# ملاحظة",
			other: "# ملاحظة",
		},
	},
	unit: {
		en: { one: "1 unit", other: "# units" },
		ar: {
			zero: "لا وحدات",
			one: "وحدة واحدة",
			two: "وحدتان",
			few: "# وحدات",
			many: "# وحدة",
			other: "# وحدة",
		},
	},
	lesson: {
		en: { one: "1 lesson", other: "# lessons" },
		ar: {
			zero: "لا دروس",
			one: "درس واحد",
			two: "درسان",
			few: "# دروس",
			many: "# درسًا",
			other: "# درس",
		},
	},
	fact: {
		en: { one: "1 fact", other: "# facts" },
		ar: {
			zero: "لا حقائق",
			one: "حقيقة واحدة",
			two: "حقيقتان",
			few: "# حقائق",
			many: "# حقيقة",
			other: "# حقيقة",
		},
	},
	course: {
		en: { one: "1 course", other: "# courses" },
		ar: {
			zero: "لا مقررات",
			one: "مقرر واحد",
			two: "مقرران",
			few: "# مقررات",
			many: "# مقررًا",
			other: "# مقرر",
		},
	},
	exam: {
		en: { one: "1 exam", other: "# exams" },
		ar: {
			zero: "لا اختبارات",
			one: "اختبار واحد",
			two: "اختباران",
			few: "# اختبارات",
			many: "# اختبارًا",
			other: "# اختبار",
		},
	},
	skill: {
		en: { one: "1 skill", other: "# skills" },
		ar: {
			zero: "لا مهارات",
			one: "مهارة واحدة",
			two: "مهارتان",
			few: "# مهارات",
			many: "# مهارة",
			other: "# مهارة",
		},
	},
	courseFolder: {
		en: { one: "1 course folder", other: "# course folders" },
		ar: {
			zero: "لا مجلدات مقررات",
			one: "مجلد مقرر واحد",
			two: "مجلدا مقرر",
			few: "# مجلدات مقررات",
			many: "# مجلد مقرر",
			other: "# مجلد مقرر",
		},
	},
	changeSet: {
		en: { one: "1 change set", other: "# change sets" },
		ar: {
			zero: "لا مجموعات تغييرات",
			one: "مجموعة تغييرات واحدة",
			two: "مجموعتا تغييرات",
			few: "# مجموعات تغييرات",
			many: "# مجموعة تغييرات",
			other: "# مجموعة تغييرات",
		},
	},
	paper: {
		en: { one: "1 paper", other: "# papers" },
		ar: {
			zero: "لا أوراق",
			one: "ورقة واحدة",
			two: "ورقتان",
			few: "# أوراق",
			many: "# ورقة",
			other: "# ورقة",
		},
	},
	question: {
		en: { one: "1 question", other: "# questions" },
		ar: {
			zero: "لا أسئلة",
			one: "سؤال واحد",
			two: "سؤالان",
			few: "# أسئلة",
			many: "# سؤالًا",
			other: "# سؤال",
		},
	},
	imagePage: {
		en: { one: "1 image page", other: "# image pages" },
		ar: {
			zero: "لا صفحات مصوّرة",
			one: "صفحة مصوّرة واحدة",
			two: "صفحتان مصوّرتان",
			few: "# صفحات مصوّرة",
			many: "# صفحة مصوّرة",
			other: "# صفحة مصوّرة",
		},
	},
	number: {
		en: { one: "1 number", other: "# numbers" },
		ar: {
			zero: "لا أرقام",
			one: "رقم واحد",
			two: "رقمان",
			few: "# أرقام",
			many: "# رقمًا",
			other: "# رقم",
		},
	},
	subject: {
		en: { one: "1 subject", other: "# subjects" },
		ar: {
			zero: "لا مواد",
			one: "مادة واحدة",
			two: "مادتان",
			few: "# مواد",
			many: "# مادة",
			other: "# مادة",
		},
	},
};

/** True when `name` is a noun the count strings know. */
export function isCountedNoun(name: string): name is Noun {
	return name in countedNouns;
}

const arabicPlural = new Intl.PluralRules("ar");

/** A count and its noun in `lang`: "3 files", "لا ملفات", "11 ملفًا". */
export function countText(lang: Lang, noun: Noun, count: number): string {
	const forms = countedNouns[noun];
	const digits = String(count);
	if (lang === "en")
		return (count === 1 ? forms.en.one : forms.en.other).replace("#", digits);
	const form = forms.ar[arabicPlural.select(count) as keyof typeof forms.ar];
	return form.replace("#", digits);
}

/**
 * The text for `key` in `lang`, with {name} placeholders filled from `vars`. A count written
 * `{n:noun}` also takes the noun's form for that number, in both languages.
 */
export function t(
	lang: Lang,
	key: TextKey,
	vars?: Record<string, string | number>,
): string {
	const value = studioText[lang][key];
	if (vars === undefined) return value;
	return value.replace(
		/\{(\w+)(?::(\w+))?\}/g,
		(placeholder, name: string, noun: string | undefined) => {
			if (!(name in vars)) return placeholder;
			if (noun === undefined) return String(vars[name]);
			if (!isCountedNoun(noun))
				throw new Error(`unknown counted noun: ${noun}`);
			return countText(lang, noun, Number(vars[name]));
		},
	);
}

/** True when the language reads right to left. */
export function isRightToLeft(lang: Lang): boolean {
	return lang === "ar";
}

/** A grade in the chosen language: en "KG1" / "Grade 7"; ar "الروضة الأولى" / "الصف 7". */
export function gradeLabel(lang: Lang, grade: number): string {
	if (lang === "ar") {
		if (grade === -1) return "الروضة الأولى";
		if (grade === 0) return "الروضة الثانية";
		return `الصف ${grade}`;
	}
	return gradeName(grade);
}

/** A language as the switch shows it: each in its own script. */
export const LANGUAGE_NAMES: Record<Lang, string> = {
	en: "English",
	ar: "العربية",
};
