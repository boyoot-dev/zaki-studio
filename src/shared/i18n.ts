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
	"start.new": "Start a new curriculum",
	"start.newHint":
		"For a teacher with a school book: name it, choose grades and subjects, then add your book.",
	"start.have": "I already have…",
	"start.open": "A Studio project",
	"start.openHint": "Open the folder of a project you made before.",
	"start.recent": "Recent projects",
	"start.recentEmpty":
		"Nothing yet. The projects you open will be listed here.",
	"start.recentMissing": "That folder is not there any more.",
	"start.adopt": "A folder of material I organised before",
	"start.adoptHint":
		"Bring material you prepared before, the work done on it and the curriculum built from it into one project.",

	// What goes in a subject's section folders, after their names in the tree (task 243).
	"tree.hint.books": "the school book, whole or in parts",
	"tree.hint.units": "one file per unit, if you have them",
	"tree.hint.extra": "worksheets, practice and assessment books",
	"tree.hint.exam": "past exam papers",

	// Settings: how the author uses AI, chosen once per computer (task 244).
	"settings.open": "Settings",
	"settings.title": "Settings",
	"settings.close": "Close",
	"ai.question": "How do you use AI?",
	"ai.firstTime": "Before the first AI step: how do you use AI?",
	"ai.tool": "My AI tool on this computer (Claude Code or Claude Desktop)",
	"ai.toolHint":
		"The Studio prepares a folder and a message; you give the message to your tool, then press Collect.",
	"ai.key": "An OpenRouter key (advanced)",
	"ai.keyHint":
		"The Studio sends your material to OpenRouter with your key and pays per use.",
	"ai.browser": "Claude or Gemini in the browser",
	"ai.browserHint":
		"The Studio prepares a file; you upload it to the chat and paste the answer back, once per unit.",
	"ai.usingBrowser": "Using: Claude or Gemini in the browser",
	"ai.whichTool": "Which tool",
	"ai.usingTool": "Using: {tool}",
	"ai.usingKey": "Using: your OpenRouter key",
	"ai.change": "Change in Settings",
	"ai.keyMissing": "Your OpenRouter key is not saved on this computer yet.",
	"ai.openSettings": "Open Settings",
	"ai.notesStep": "Reading your files (notes)",
	"ai.unitsStep": "Units and exams",
	"cost.cents": "about {usd} ({n:cent})",
	"cost.dollars": "about {usd}",

	// Build from my book (task 246).
	"book.build": "Build from my book",
	"book.update": "Update from my files",
	"book.files": "The files it will use",
	"book.fileLine": "{kind} · {n:page}",
	"book.more": "and {n:file} more",
	"book.toRead": "The Studio reads {n:file} first.",
	"book.periods": "It builds: {periods}",
	"book.time": "It should take about {n:minute}.",
	"book.cost": "With your key it costs {cost}.",
	"book.noTerm":
		"{n:file} have no term and are left out: put them in a term's folder, or choose their term in the file's details.",
	"book.noFiles":
		"This course has no files to build from yet. Put your book in its Books folder first.",
	"book.start": "Start",
	"book.starting": "Studio is reading your book…",
	"book.give":
		"Give this message to {tool}. When it says it has finished, press Collect.",
	"book.copy": "Copy the message",
	"book.collect": "Collect",
	"book.collected":
		"Read: {read:file}. Waiting for your review: {sets:proposal}.",
	"book.nothingYet":
		"Nothing to collect yet. Wait until your tool says it has finished.",
	"book.openReview": "Open Review",
	"book.progressNotes": "Reading your files: {done} of {total}",
	"book.progressUnits": "Proposing the units: {done} of {total}",
	"book.built": "Done. Waiting for your review: {sets:proposal}.",
	"book.stopped":
		"The spending limit stopped the build. Raise it in Settings and press Start again.",
	"book.lastJob": "A build prepared on {created} can be collected:",
	// The browser rounds (task 245).
	"rounds.guess":
		"This takes about {n:round}: in each, one file to upload and one answer to paste.",
	"rounds.period": "Period",
	"rounds.outline": "Round {round} of about {total}: the outline",
	"rounds.unit": "Round {round} of {total}: Unit {unit} · {title}",
	"rounds.part": " (part {part} of {parts})",
	"rounds.steps":
		"Upload this file to the chat, copy the message below into it, then paste the whole answer here.",
	"rounds.showFile": "Show the file",
	"rounds.paste": "Paste the answer here",
	"rounds.check": "Check the answer",
	"rounds.kept": "Kept. On to the next round.",
	"rounds.done": "All rounds are done. The units wait for your review.",
	"rounds.again": "Start again",

	// Editing the curriculum by hand (task 247).
	"edit.edit": "Edit",
	"edit.save": "Save",
	"edit.cancel": "Cancel",
	"edit.more": "More",
	"edit.up": "Move up",
	"edit.down": "Move down",
	"edit.delete": "Delete",
	"edit.toUnit": "Move to unit {n}",
	"edit.toPeriod": "Move to {period}",
	"edit.addFact": "+ Add a fact",
	"edit.addSkill": "+ Add a skill",
	"edit.addLesson": "+ Add a lesson",
	"edit.addUnit": "+ Add a unit",
	"edit.confirmFact": "Delete this fact?",
	"edit.confirmSkill": "Delete this skill?",
	"edit.confirmLesson": "Delete this lesson and its facts?",
	"edit.confirmUnit": "Delete this unit and its lessons?",
	"edit.yours": "yours",
	"edit.undo": "Undo",
	"edit.undone": "The last edit is undone.",
	"edit.lessonNotExported":
		"Add a skill: a lesson needs at least one to be exported.",
	"edit.manyFacts": "One per line: each line becomes one fact.",
	"edit.manySkills": "One per line: each line becomes one skill.",
	"edit.keywords": "Key words",
	"edit.evidence": "How it is assessed",
	"edit.none": "None yet.",
	"edit.activity": "Activity",
	"edit.activityNone": "None",
	"edit.activityReading": "Reading",
	"edit.activityWriting": "Writing",
	"steps.notNeeded": "Not needed: you typed the curriculum yourself.",
	"edit.unitNotExported":
		"Not in the export until one of its lessons has a skill.",
	"edit.newUnitPeriod": "Period",

	// Asking the AI for one change (task 248).
	"ask.open": "Ask the AI…",
	"ask.title": "Ask the AI for a change",
	"ask.unit": "Unit {unit} · {title}",
	"ask.lesson": "Unit {unit} · Lesson {lesson} · {title}",
	"ask.hint":
		"What should change? For example: “add the point about …”, “split this lesson into two”, “make the facts simpler”.",
	"ask.count": "{n} of {max} characters",
	"ask.send": "Send",
	"ask.upload":
		"The file is shown in Explorer: upload it to the chat, copy the message below into it, then paste the whole answer here.",
	"ask.sent": "The proposal waits for your review.",
	"ask.refused":
		"The answer changed more than this unit, or did not pass the check. Ask your tool again.",
	"ask.youAsked": "You asked: {text}",

	// The pages the AI never used (task 250).
	"cover.used": "Used {used} of {total} pages with text.",
	"cover.all": "Every page with text is used ({total}).",
	"cover.notUsed": "Not used:",
	"cover.warn":
		"Many pages were not used. Check whether the AI skipped part of the material before you accept.",
	"cover.gaps": "These pages with text are in no unit of the outline:",
	"cover.gapsHint":
		"If they hold lessons, press “Start again” and ask the chat to use every page.",
	"cover.page": "p. {n}",
	"cover.range": "p. {from}–{to}",

	// The wizard.
	"wizard.secondLanguage": "+ another language",
	"wizard.secondLanguageLabel": "Also taught in",
	"wizard.secondLanguageRemove": "Remove the second language",
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
	"project.dropHint":
		"Files dropped here go into the folder chosen in the tree, or into the Inbox when none is chosen. They are copied, never moved.",
	// What to do next, when no file is open (task 243).
	"steps.title": "What to do next",
	"steps.put":
		"Put your book in a subject's Books folder: drag it onto the folder in the tree, or select the folder and press Ctrl+V.",
	"steps.read": "Let the Studio read it.",
	"steps.build": "Build the units.",
	"steps.buildGo": "Build from my book",
	"steps.export": "Export the curriculum.",
	"steps.exportGo": "Export",
	"steps.done": "(done)",
	"steps.secondLanguage":
		"Same book in another language? That is a second course: add it from the Curriculum tab.",
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
	"start.bundle": "A curriculum file (.zaki)",
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
	"project.tab.changes": "Review",
	"project.advanced": "Advanced",
	"changes.title": "Review",
	"changes.intro":
		"What the AI proposed waits here for you: accept what is right, reject the rest. Nothing reaches the curriculum before you accept it.",
	"changes.settings": "The model and the limit",
	"changes.model": "Model",
	"changes.limit": "The limit for one proposal (US dollars)",
	"changes.saveSettings": "Save",
	"changes.targets": "Course periods",
	"changes.targetLine":
		"{units:unit} · {lessons:lesson} · {files:file} · {notes} with a note",
	"changes.pending": "a proposal is waiting",
	"changes.plan": "{units:unit} and {notes:note}: about {cost} with {model}.",
	"changes.noPrice":
		"The model's price is not known, so the cost cannot be shown.",
	"changes.write": "Write with my key",
	"changes.confirmWrite": "Write it",
	"changes.writing": "Writing the proposal…",
	"changes.wrote": "The proposal is ready to review.",
	"changes.noKeyHint":
		"Save a key in the Notes tab, or prepare a job for your own AI tool below.",
	"changes.pickHint": "Tick the periods to put in one job folder.",
	"changes.jobTitle": "With my AI tool",
	"changes.jobIntro":
		"The Studio writes a folder with a fixed prompt. Paste it into your tool; it writes one proposal per course folder, and you collect them here. The Studio never drives another program.",
	"changes.prepare": "Prepare a job for my AI tool",
	"changes.preparing": "Preparing…",
	"changes.jobReady": "The job is ready for {n:courseFolder}.",
	"changes.collect": "Collect",
	"changes.collecting": "Collecting…",
	"changes.saving": "Saving…",
	"changes.collected": "Collected: {n:changeSet}.",
	"changes.collectedSkipped":
		"Collected: {n:changeSet}. Skipped, already waiting: {skipped:changeSet}.",
	"changes.jobs": "Jobs",
	"changes.jobsNone": "No job yet.",
	"changes.jobLine": "{created} · {tool} · {n:courseFolder}",
	"changes.review": "Waiting for review",
	"changes.waiting": "Waiting for your review",
	"changes.examFormat": "Exam format",
	"changes.examFormatIntro":
		"For each course with past exam papers, the Studio can build the exam format the tutor practises with: the papers, parts, timing and marks.",
	"changes.examBuild": "Build the exam format",
	"changes.examBrowser":
		"This step needs Claude Code or an OpenRouter key for now.",
	"changes.older": "Rejected proposals and older jobs",
	"changes.oldUnitJobs": "Older unit jobs",
	"changes.oldExamJobs": "Older exam jobs",
	"changes.none":
		"Nothing waits for your review. Build units from a course in the Curriculum tab.",
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
	"changes.openDecide": "Needs your decision",
	"changes.openInfo": "For your information ({n})",
	"changes.refused": "Refused items",
	"changes.rejected": "Rejected proposals",
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
	"changes.refusal.invalid": "not a proposal this project can review",
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
		"Prepare one folder per course with its exam notes, then collect the exam proposals your tool writes.",
	"changes.examPrepare": "Prepare an exams job",
	"changes.examJobReady": "The exams job is ready for {n:courseFolder}.",
	"changes.examWrite": "Write the exams with my key",
	"changes.examPickHint": "Tick the courses to put in one exams job.",
	"changes.examsNone": "No exam proposal is waiting.",
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
	"detail.term": "Term",
	"detail.termNone": "Not set",
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
	"new.why.noTerm":
		"no term: put it in a term's folder, or choose its term in the file's details",
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

	"start.new": "ابدأ منهجًا جديدًا",
	"start.newHint":
		"للمعلم الذي لديه كتاب المدرسة: سمِّه، واختر الصفوف والمواد، ثم أضف كتابك.",
	"start.have": "لديّ بالفعل…",
	"start.open": "مشروع استوديو",
	"start.openHint": "افتح مجلد مشروع أنشأته من قبل.",
	"start.recent": "المشروعات الأخيرة",
	"start.recentEmpty": "لا شيء بعد. ستظهر هنا المشروعات التي تفتحها.",
	"start.recentMissing": "هذا المجلد لم يعد موجودًا.",
	"start.adopt": "مجلد مواد نظّمتُه من قبل",
	"start.adoptHint":
		"اجمع موادًّا أعددتَها من قبل، والعمل الذي تمّ عليها، والمنهج المبنيّ منها، في مشروع واحد.",

	"tree.hint.books": "كتاب المدرسة كاملًا أو أجزاءً",
	"tree.hint.units": "ملف لكل وحدة إن وُجد",
	"tree.hint.extra": "أوراق العمل والتدريبات وكتب التقويم",
	"tree.hint.exam": "امتحانات سابقة",

	"settings.open": "الإعدادات",
	"settings.title": "الإعدادات",
	"settings.close": "إغلاق",
	"ai.question": "كيف تستخدم الذكاء الاصطناعي؟",
	"ai.firstTime": "قبل أول خطوة بالذكاء الاصطناعي: كيف تستخدمه؟",
	"ai.tool":
		"أداة ذكاء اصطناعي على هذا الحاسوب (Claude Code أو Claude Desktop)",
	"ai.toolHint":
		"يجهّز الاستوديو مجلدًا ورسالة؛ تعطي الرسالة لأداتك، ثم تضغط «اجمع».",
	"ai.key": "مفتاح OpenRouter (متقدّم)",
	"ai.keyHint":
		"يرسل الاستوديو موادّك إلى OpenRouter بمفتاحك، وتدفع حسب الاستخدام.",
	"ai.browser": "Claude أو Gemini في المتصفح",
	"ai.browserHint":
		"يجهّز الاستوديو ملفًا؛ ترفعه إلى المحادثة وتلصق الإجابة هنا، مرة لكل وحدة.",
	"ai.usingBrowser": "تستخدم: Claude أو Gemini في المتصفح",
	"ai.whichTool": "أي أداة",
	"ai.usingTool": "تستخدم: {tool}",
	"ai.usingKey": "تستخدم: مفتاح OpenRouter الخاص بك",
	"ai.change": "غيّر من الإعدادات",
	"ai.keyMissing": "لم يُحفظ مفتاح OpenRouter على هذا الحاسوب بعد.",
	"ai.openSettings": "افتح الإعدادات",
	"ai.notesStep": "قراءة ملفاتك (الملاحظات)",
	"ai.unitsStep": "الوحدات والامتحانات",
	"cost.cents": "نحو {usd} دولار ({n:cent})",
	"cost.dollars": "نحو {usd} دولار",
	"book.build": "ابنِ المنهج من كتابي",
	"book.update": "حدّث من ملفاتي",
	"book.files": "الملفات التي سيستخدمها",
	"book.fileLine": "{kind} · {n:page}",
	"book.more": "و{n:file} أخرى",
	"book.toRead": "يقرأ الاستوديو {n:file} أولًا.",
	"book.periods": "يبني: {periods}",
	"book.time": "يستغرق نحو {n:minute}.",
	"book.cost": "التكلفة بمفتاحك {cost}.",
	"book.noTerm":
		"{n:file} بلا فصل دراسي ولن تُستخدم: ضعها في مجلد فصلها، أو اختر فصلها في تفاصيل الملف.",
	"book.noFiles":
		"لا ملفات لهذا المقرر يُبنى منها بعد. ضع كتابك في مجلد «Books» الخاص به أولًا.",
	"book.start": "ابدأ",
	"book.starting": "يقرأ الاستوديو كتابك…",
	"book.give": "أعطِ هذه الرسالة لـ{tool}. عندما يقول إنه انتهى، اضغط «اجمع».",
	"book.copy": "انسخ الرسالة",
	"book.collect": "اجمع",
	"book.collected": "قُرئ: {read:file}. بانتظار مراجعتك: {sets:proposal}.",
	"book.nothingYet": "لا شيء لجمعه بعد. انتظر حتى تقول أداتك إنها انتهت.",
	"book.openReview": "افتح المراجعة",
	"book.progressNotes": "قراءة ملفاتك: {done} من {total}",
	"book.progressUnits": "اقتراح الوحدات: {done} من {total}",
	"book.built": "تمّ. بانتظار مراجعتك: {sets:proposal}.",
	"book.stopped":
		"أوقف حدّ الإنفاق البناء. ارفعه من الإعدادات ثم اضغط «ابدأ» مرة أخرى.",
	"book.lastJob": "يمكن جمع بناء جُهّز في {created}:",
	"rounds.guess":
		"يستغرق هذا نحو {n:round}: في كل جولة ملف ترفعه وإجابة تلصقها.",
	"rounds.period": "الفترة",
	"rounds.outline": "الجولة {round} من نحو {total}: المخطط",
	"rounds.unit": "الجولة {round} من {total}: الوحدة {unit} · {title}",
	"rounds.part": " (الجزء {part} من {parts})",
	"rounds.steps":
		"ارفع هذا الملف إلى المحادثة، وانسخ الرسالة أدناه إليها، ثم ألصق الإجابة كاملة هنا.",
	"rounds.showFile": "اعرض الملف",
	"rounds.paste": "ألصق الإجابة هنا",
	"rounds.check": "افحص الإجابة",
	"rounds.kept": "حُفظت. إلى الجولة التالية.",
	"rounds.done": "انتهت الجولات. الوحدات بانتظار مراجعتك.",
	"rounds.again": "ابدأ من جديد",
	"edit.edit": "تعديل",
	"edit.save": "احفظ",
	"edit.cancel": "إلغاء",
	"edit.more": "المزيد",
	"edit.up": "انقل لأعلى",
	"edit.down": "انقل لأسفل",
	"edit.delete": "احذف",
	"edit.toUnit": "انقل إلى الوحدة {n}",
	"edit.toPeriod": "انقل إلى {period}",
	"edit.addFact": "+ أضف معلومة",
	"edit.addSkill": "+ أضف مهارة",
	"edit.addLesson": "+ أضف درسًا",
	"edit.addUnit": "+ أضف وحدة",
	"edit.confirmFact": "أأحذف هذه المعلومة؟",
	"edit.confirmSkill": "أأحذف هذه المهارة؟",
	"edit.confirmLesson": "أأحذف هذا الدرس ومعلوماته؟",
	"edit.confirmUnit": "أأحذف هذه الوحدة ودروسها؟",
	"edit.yours": "من إضافتك",
	"edit.undo": "تراجع",
	"edit.undone": "تُرُوجع عن آخر تعديل.",
	"edit.lessonNotExported":
		"أضف مهارة: يحتاج الدرس مهارة واحدة على الأقل ليُصدَّر.",
	"edit.manyFacts": "سطر لكل معلومة: يصبح كل سطر معلومة.",
	"edit.manySkills": "سطر لكل مهارة: يصبح كل سطر مهارة.",
	"edit.keywords": "الكلمات المفتاحية",
	"edit.evidence": "كيف تُقيَّم",
	"edit.none": "لا شيء بعد.",
	"edit.activity": "النشاط",
	"edit.activityNone": "لا شيء",
	"edit.activityReading": "قراءة",
	"edit.activityWriting": "كتابة",
	"steps.notNeeded": "غير مطلوب: كتبتَ المنهج بنفسك.",
	"edit.unitNotExported": "لن تُصدَّر حتى تكون لأحد دروسها مهارة.",
	"edit.newUnitPeriod": "الفترة",
	"ask.open": "اطلب من الذكاء الاصطناعي…",
	"ask.title": "اطلب تغييرًا من الذكاء الاصطناعي",
	"ask.unit": "الوحدة {unit} · {title}",
	"ask.lesson": "الوحدة {unit} · الدرس {lesson} · {title}",
	"ask.hint":
		"ماذا تريد أن يتغير؟ مثلًا: «أضف النقطة الخاصة بـ…»، «قسّم هذا الدرس إلى درسين»، «بسّط المعلومات».",
	"ask.count": "{n} من {max} حرفًا",
	"ask.send": "أرسل",
	"ask.upload":
		"الملف معروض في المستكشف: ارفعه إلى المحادثة، وانسخ الرسالة أدناه إليها، ثم ألصق الإجابة كاملة هنا.",
	"ask.sent": "المقترح بانتظار مراجعتك.",
	"ask.refused":
		"غيّرت الإجابة أكثر من هذه الوحدة، أو لم تجتز الفحص. اطلب من أداتك مرة أخرى.",
	"ask.youAsked": "طلبتَ: {text}",
	"cover.used": "استُخدمت {used} من أصل {total} صفحة فيها نص.",
	"cover.all": "استُخدمت كل الصفحات التي فيها نص ({total}).",
	"cover.notUsed": "لم تُستخدم:",
	"cover.warn":
		"صفحات كثيرة لم تُستخدم. تحقّق هل تخطّى الذكاء الاصطناعي جزءًا من المادة قبل أن تقبل.",
	"cover.gaps": "هذه الصفحات التي فيها نص ليست في أي وحدة من المخطط:",
	"cover.gapsHint":
		"إن كانت فيها دروس، اضغط «ابدأ من جديد» واطلب من المحادثة أن تستخدم كل الصفحات.",
	"cover.page": "ص {n}",
	"cover.range": "ص {from}–{to}",
	"wizard.secondLanguage": "+ لغة أخرى",
	"wizard.secondLanguageLabel": "تُدرَّس أيضًا بـ",
	"wizard.secondLanguageRemove": "احذف اللغة الثانية",
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
	"project.dropHint":
		"الملفات التي تُفلتها هنا تذهب إلى المجلد المختار في الشجرة، أو إلى «Inbox» إن لم تختر مجلدًا. تُنسخ ولا تُنقل.",
	"steps.title": "ماذا تفعل الآن",
	"steps.put":
		"ضع كتابك في مجلد «Books» لمادته: اسحبه إلى المجلد في الشجرة، أو اختر المجلد واضغط Ctrl+V.",
	"steps.read": "دع الاستوديو يقرؤه.",
	"steps.build": "ابنِ الوحدات.",
	"steps.buildGo": "ابنِ المنهج من كتابي",
	"steps.export": "صدِّر المنهج.",
	"steps.exportGo": "صدِّر",
	"steps.done": "(تمّ)",
	"steps.secondLanguage":
		"الكتاب نفسه بلغة أخرى؟ هذا مقرر ثانٍ: أضفه من تبويب «المنهج».",
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
	"start.bundle": "ملف منهج (‎.zaki)",
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
	"project.tab.changes": "المراجعة",
	"project.advanced": "متقدّم",
	"changes.title": "المراجعة",
	"changes.intro":
		"ما اقترحه الذكاء الاصطناعي ينتظرك هنا: اقبل الصحيح وارفض الباقي. لا يدخل شيء إلى المنهج قبل أن تقبله.",
	"changes.settings": "النموذج والحدّ",
	"changes.model": "النموذج",
	"changes.limit": "حدّ الإنفاق للتغيير الواحد (دولار)",
	"changes.saveSettings": "احفظ",
	"changes.targets": "مراحل المقررات",
	"changes.targetLine":
		"{units:unit} · {lessons:lesson} · {files:file} · {notes} بملاحظة",
	"changes.pending": "مقترح ينتظر",
	"changes.plan": "{units:unit} و{notes:note}: نحو {cost} بالنموذج {model}.",
	"changes.noPrice": "سعر النموذج غير معروف، فلا يمكن عرض الكلفة.",
	"changes.write": "اكتب بمفتاحي",
	"changes.confirmWrite": "اكتبه",
	"changes.writing": "جارٍ كتابة المقترح…",
	"changes.wrote": "المقترح جاهز للمراجعة.",
	"changes.noKeyHint":
		"احفظ مفتاحًا في تبويب الملاحظات، أو جهّز عملًا لأداتك في الأسفل.",
	"changes.pickHint": "أشّر المراحل التي تريدها في مجلد عمل واحد.",
	"changes.jobTitle": "بأداتي",
	"changes.jobIntro":
		"يكتب الاستوديو مجلدًا فيه طلب ثابت. ألصق الطلب في أداتك؛ تكتب تغييرات لكل مجلد مقرر، ثم تجمعها هنا. ولا يشغّل الاستوديو برنامجًا آخر.",
	"changes.prepare": "جهّز عملًا لأداتي",
	"changes.preparing": "جارٍ التجهيز…",
	"changes.jobReady": "العمل جاهز لـ{n:courseFolder}.",
	"changes.collect": "اجمع",
	"changes.collecting": "جارٍ الجمع…",
	"changes.saving": "جارٍ الحفظ…",
	"changes.collected": "المجمّع: {n:changeSet}.",
	"changes.collectedSkipped":
		"المجمّع: {n:changeSet}. والمتخطّى لأنه ينتظر من قبل: {skipped:changeSet}.",
	"changes.jobs": "الأعمال",
	"changes.jobsNone": "لا يوجد عمل بعد.",
	"changes.jobLine": "{created} · {tool} · {n:courseFolder}",
	"changes.review": "تنتظر المراجعة",
	"changes.waiting": "بانتظار مراجعتك",
	"changes.examFormat": "شكل الامتحانات",
	"changes.examFormatIntro":
		"لكل مقرر له امتحانات سابقة، يبني الاستوديو شكل الامتحانات الذي يتدرّب عليه الطفل: الأوراق والأجزاء والوقت والدرجات.",
	"changes.examBuild": "ابنِ شكل الامتحانات",
	"changes.examBrowser":
		"هذه الخطوة تحتاج Claude Code أو مفتاح OpenRouter حاليًا.",
	"changes.older": "مقترحات مرفوضة وأعمال أقدم",
	"changes.oldUnitJobs": "أعمال وحدات أقدم",
	"changes.oldExamJobs": "أعمال امتحانات أقدم",
	"changes.none":
		"لا شيء بانتظار مراجعتك. ابنِ الوحدات من مقرر في تبويب «المنهج».",
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
	"changes.openDecide": "يحتاج قرارك",
	"changes.openInfo": "للعلم ({n})",
	"changes.refused": "عناصر مرفوضة",
	"changes.rejected": "مقترحات مرفوضة",
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
	"detail.term": "الفصل الدراسي",
	"detail.termNone": "غير محدد",
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
	"new.why.noTerm":
		"بلا فصل دراسي: ضعه في مجلد فصله، أو اختر فصله في تفاصيل الملف",
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
	| "subject"
	| "cent"
	| "minute"
	| "proposal"
	| "round";

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
		en: { one: "1 proposal", other: "# proposals" },
		ar: {
			zero: "لا مقترحات",
			one: "مقترح واحد",
			two: "مقترحان",
			few: "# مقترحات",
			many: "# مقترحًا",
			other: "# مقترح",
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
	minute: {
		en: { one: "1 minute", other: "# minutes" },
		ar: {
			zero: "لا دقائق",
			one: "دقيقة واحدة",
			two: "دقيقتان",
			few: "# دقائق",
			many: "# دقيقة",
			other: "# دقيقة",
		},
	},
	round: {
		en: { one: "1 round", other: "# rounds" },
		ar: {
			zero: "لا جولات",
			one: "جولة واحدة",
			two: "جولتين",
			few: "# جولات",
			many: "# جولة",
			other: "# جولة",
		},
	},
	proposal: {
		en: { one: "1 proposal", other: "# proposals" },
		ar: {
			zero: "لا مقترحات",
			one: "مقترح واحد",
			two: "مقترحان",
			few: "# مقترحات",
			many: "# مقترحًا",
			other: "# مقترح",
		},
	},
	cent: {
		en: { one: "1 US cent", other: "# US cents" },
		ar: {
			zero: "لا سنتات",
			one: "سنت واحد",
			two: "سنتان",
			few: "# سنتات",
			many: "# سنتًا",
			other: "# سنت",
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
