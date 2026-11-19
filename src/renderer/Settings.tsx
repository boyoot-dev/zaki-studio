// Settings (task 244): how the author uses AI, chosen once per computer, and for the key way the
// key, the model and the spending limit of each step. Every AI step reads this choice; the
// Notes and Changes tabs only say which way is in use and link here. The choice itself can also
// be made inline, the first time an AI step is reached (`AiWayPicker`).

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";

import type { AiChoice } from "../shared/ai";
import type { AiState } from "../shared/api";
import type { JobTool } from "../shared/job";
import { failureText } from "./App";
import { useLang, useSay } from "./i18n";

/** What the AI context gives: the state (null while it loads), a re-read, and the opener. */
type AiContextValue = {
	ai: AiState | null;
	reload: () => Promise<void>;
	openSettings: () => void;
	notify: (text: string) => void;
};

const AiContext = createContext<AiContextValue>({
	ai: null,
	reload: async () => {},
	openSettings: () => {},
	notify: () => {},
});

/** The AI choice and settings, shared by every page; App holds one provider. */
export function useAi(): AiContextValue {
	return useContext(AiContext);
}

/** Holds the AI state for the window, and shows Settings when asked. */
export function AiProvider({
	children,
	onNotify,
}: {
	children: ReactNode;
	onNotify: (text: string) => void;
}) {
	const [ai, setAi] = useState<AiState | null>(null);
	const [open, setOpen] = useState(false);
	const reload = useCallback(async () => {
		setAi(await window.studio.aiState());
	}, []);
	useEffect(() => {
		void reload();
	}, [reload]);
	const close = useCallback(() => setOpen(false), []);
	return (
		<AiContext.Provider
			value={{
				ai,
				reload,
				openSettings: () => setOpen(true),
				notify: onNotify,
			}}
		>
			{children}
			{open && <Settings onClose={close} />}
		</AiContext.Provider>
	);
}

/** The two ways as a choice; choosing one keeps it at once. */
export function AiWayPicker({ heading }: { heading: string }) {
	const say = useSay();
	const lang = useLang();
	const { ai, reload, notify } = useAi();
	const choice = ai?.choice ?? null;

	const choose = async (next: AiChoice) => {
		const saved = await window.studio.saveAi(next);
		if (!saved.ok) {
			notify(failureText(lang, saved));
			return;
		}
		await reload();
	};

	return (
		<fieldset className="ai-ways">
			<legend>{heading}</legend>
			<label className="ai-way">
				<input
					type="radio"
					name="ai-way"
					checked={choice?.way === "tool"}
					onChange={() => void choose({ way: "tool", tool: toolOf(choice) })}
				/>
				<span>
					<span className="ai-way-title">{say("ai.tool")}</span>
					<span className="muted">{say("ai.toolHint")}</span>
				</span>
			</label>
			{choice?.way === "tool" && (
				<label className="field ai-tool">
					<span className="field-label">{say("ai.whichTool")}</span>
					<select
						value={choice.tool}
						onChange={(event) =>
							void choose({
								way: "tool",
								tool: event.target.value as JobTool,
							})
						}
					>
						<option value="claude-code">{say("notes.tool.claude-code")}</option>
						<option value="other">{say("notes.tool.other")}</option>
					</select>
				</label>
			)}
			<label className="ai-way">
				<input
					type="radio"
					name="ai-way"
					checked={choice?.way === "key"}
					onChange={() => void choose({ way: "key" })}
				/>
				<span>
					<span className="ai-way-title">{say("ai.key")}</span>
					<span className="muted">{say("ai.keyHint")}</span>
				</span>
			</label>
		</fieldset>
	);
}

/** The tool a choice names, or Claude Code. */
function toolOf(choice: AiChoice | null): JobTool {
	return choice?.way === "tool" ? choice.tool : "claude-code";
}

/**
 * The one line an AI step shows: which way is in use and a link to Settings; with the key way
 * and no key yet, says so with a button, never a silent grey button.
 */
export function AiLine() {
	const say = useSay();
	const { ai, openSettings } = useAi();
	if (ai === null || ai.choice === null) return null;
	const using =
		ai.choice.way === "tool"
			? say("ai.usingTool", {
					tool: say(`notes.tool.${ai.choice.tool}`),
				})
			: say("ai.usingKey");
	return (
		<div className="ai-line">
			<p className="muted">
				{using} ·{" "}
				<button type="button" className="link-button" onClick={openSettings}>
					{say("ai.change")}
				</button>
			</p>
			{ai.choice.way === "key" && !ai.keySet && (
				<p className="issues">
					{say("ai.keyMissing")}{" "}
					<button
						type="button"
						className="btn btn-quiet"
						onClick={openSettings}
					>
						{say("ai.openSettings")}
					</button>
				</p>
			)}
		</div>
	);
}

/**
 * What an AI step shows before its own buttons: the choice inline the first time (nothing
 * chosen yet), else the one line. `ready` is false while the choice is missing, so the step
 * hides its buttons.
 */
export function useAiGate(): { gate: ReactNode; ready: boolean } {
	const say = useSay();
	const { ai } = useAi();
	if (ai === null) return { gate: null, ready: false };
	if (ai.choice === null)
		return {
			gate: <AiWayPicker heading={say("ai.firstTime")} />,
			ready: false,
		};
	return { gate: <AiLine />, ready: true };
}

/** The Settings dialog. */
function Settings({ onClose }: { onClose: () => void }) {
	const say = useSay();
	const lang = useLang();
	const { ai, reload, notify } = useAi();
	const [keyInput, setKeyInput] = useState("");
	const [notesModel, setNotesModel] = useState("");
	const [notesLimit, setNotesLimit] = useState(2);
	const [unitsModel, setUnitsModel] = useState("");
	const [unitsLimit, setUnitsLimit] = useState(2);
	const [filled, setFilled] = useState(false);

	// The fields start from what is kept, once it has loaded.
	useEffect(() => {
		if (ai === null || filled) return;
		setNotesModel(ai.notes.model);
		setNotesLimit(ai.notes.limit);
		setUnitsModel(ai.units.model);
		setUnitsLimit(ai.units.limit);
		setFilled(true);
	}, [ai, filled]);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	const saveKey = async () => {
		const answer = await window.studio.saveKey(keyInput);
		if (!answer.ok) {
			notify(failureText(lang, answer));
			return;
		}
		setKeyInput("");
		notify(say("notes.keySaved"));
		await reload();
	};

	const testKey = async () => {
		notify(say("notes.testing"));
		const answer = await window.studio.testKey();
		notify(answer.ok ? say("notes.testOk") : failureText(lang, answer));
	};

	const clearKey = async () => {
		await window.studio.clearKey();
		notify(say("notes.keyCleared"));
		await reload();
	};

	const saveSteps = async () => {
		const notes = await window.studio.saveNoteSettings(notesModel, notesLimit);
		const units = await window.studio.saveUnitsSettings(unitsModel, unitsLimit);
		if (!notes.ok) notify(failureText(lang, notes));
		else if (!units.ok) notify(failureText(lang, units));
		else notify(say("toast.saved"));
		await reload();
	};

	const keyWay = ai?.choice?.way === "key";

	return (
		<div className="veil">
			<div
				className="dialog settings-dialog"
				aria-modal="true"
				role="dialog"
				aria-label={say("settings.title")}
			>
				<header className="new-head">
					<h2>{say("settings.title")}</h2>
					<button type="button" className="btn btn-quiet" onClick={onClose}>
						{say("settings.close")}
					</button>
				</header>

				<AiWayPicker heading={say("ai.question")} />

				{keyWay && ai !== null && (
					<section className="settings-key">
						<p className="muted">
							{ai.keySet ? say("notes.keySet") : say("notes.keyMissing")}
						</p>
						<div className="notes-row">
							<label className="field">
								<span className="field-label">{say("notes.key")}</span>
								<input
									type="password"
									value={keyInput}
									placeholder={say("notes.keyPlaceholder")}
									onChange={(event) => setKeyInput(event.target.value)}
									dir="ltr"
									autoComplete="off"
								/>
							</label>
							<button
								type="button"
								className="btn"
								disabled={keyInput.trim() === ""}
								onClick={() => void saveKey()}
							>
								{say("notes.saveKey")}
							</button>
							{ai.keySet && (
								<>
									<button
										type="button"
										className="btn btn-quiet"
										onClick={() => void testKey()}
									>
										{say("notes.testKey")}
									</button>
									<button
										type="button"
										className="btn btn-quiet btn-danger"
										onClick={() => void clearKey()}
									>
										{say("notes.clearKey")}
									</button>
								</>
							)}
						</div>
						<p className="muted">{say("notes.keyHint")}</p>

						<StepFields
							title={say("ai.notesStep")}
							model={notesModel}
							limit={notesLimit}
							onModel={setNotesModel}
							onLimit={setNotesLimit}
						/>
						<StepFields
							title={say("ai.unitsStep")}
							model={unitsModel}
							limit={unitsLimit}
							onModel={setUnitsModel}
							onLimit={setUnitsLimit}
						/>
						<button
							type="button"
							className="btn btn-quiet"
							onClick={() => void saveSteps()}
						>
							{say("notes.saveSettings")}
						</button>
					</section>
				)}
			</div>
		</div>
	);
}

/** One step's model and spending limit. */
function StepFields({
	title,
	model,
	limit,
	onModel,
	onLimit,
}: {
	title: string;
	model: string;
	limit: number;
	onModel: (value: string) => void;
	onLimit: (value: number) => void;
}) {
	const say = useSay();
	return (
		<div className="settings-step">
			<h3>{title}</h3>
			<div className="notes-row">
				<label className="field">
					<span className="field-label">{say("notes.model")}</span>
					<input
						type="text"
						value={model}
						onChange={(event) => onModel(event.target.value)}
						dir="ltr"
					/>
				</label>
				<label className="field">
					<span className="field-label">{say("notes.limit")}</span>
					<input
						type="number"
						min="0.01"
						max="100"
						step="0.5"
						value={limit}
						onChange={(event) => onLimit(Number(event.target.value) || 0)}
					/>
				</label>
			</div>
		</div>
	);
}
