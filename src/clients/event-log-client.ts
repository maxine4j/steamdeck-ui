import type { Diagnostics } from "./diagnostics";
import type { ErrorEnvironment } from "./error-context-client";

const nativeFields: Readonly<Record<string, readonly string[]>> = {
	PLAYER_ENTERING_WORLD: ["isInitialLogin", "isReloadingUi"],
	QUEST_DETAIL: ["startItem"],
	QUEST_ACCEPTED: ["questID"],
	QUEST_REMOVED: ["questID", "wasReplayQuest"],
	QUEST_TURNED_IN: ["questID", "xpReward", "moneyReward"],
	QUEST_AUTOCOMPLETE: ["questID"],
	QUEST_WATCH_UPDATE: ["questID"],
	QUEST_WATCH_LIST_CHANGED: ["questID", "added"],
	QUEST_ACCEPT_CONFIRM: ["speaker", "title", "questID"],
	GOSSIP_CLOSED: ["continuing"],
	GOSSIP_CONFIRM: ["optionID", "text", "cost"],
	GOSSIP_ENTER_CODE: ["optionID"],
	UI_ERROR_MESSAGE: ["errorType", "message"],
	PLAYER_INTERACTION_MANAGER_FRAME_SHOW: ["interactionType"],
	ADDON_RESTRICTION_STATE_CHANGED: ["restrictionType", "state"],
	ADDON_ACTION_BLOCKED: ["addon", "function"],
	ADDON_ACTION_FORBIDDEN: ["addon", "function"],
	ENCOUNTER_START: [
		"encounterID",
		"encounterName",
		"difficultyID",
		"groupSize",
	],
	ENCOUNTER_END: [
		"encounterID",
		"encounterName",
		"difficultyID",
		"groupSize",
		"success",
	],
};

interface QuestInfo {
	readonly [key: string]: unknown;
	isHeader?: boolean;
}

function secret(value: unknown): boolean {
	return (issecretvalue as unknown as (this: void, value: unknown) => boolean)(
		value,
	);
}

/** Serialize every supplied field, preserving nested table structure. */
function describe(value: unknown): string {
	const parts: string[] = [];
	const ancestors = new Set<object>();
	let remaining = 100000;
	const append = (text: string) => {
		parts.push(text.slice(0, remaining));
		remaining = Math.max(0, remaining - text.length);
	};
	const visit = (field: unknown, depth: number): void => {
		if (remaining === 0) return;
		if (secret(field)) {
			append("<secret>");
			return;
		}
		if (field === undefined || field === null) {
			append("<nil>");
			return;
		}
		if (typeof field === "string") {
			append(
				field
					.slice(0, remaining)
					.split("\n")
					.join("\\n")
					.split("\r")
					.join("\\r"),
			);
			return;
		}
		if (typeof field === "number" || typeof field === "boolean") {
			append(String(field));
			return;
		}
		if (typeof field !== "object") {
			append(`<${typeof field}>`);
			return;
		}
		if (ancestors.has(field)) {
			append("<cycle>");
			return;
		}
		if (depth >= 64) {
			append("<depth limit>");
			return;
		}
		ancestors.add(field);
		if (depth > 0) append("{");
		let first = true;
		for (const key in field) {
			if (remaining === 0) break;
			if (!first) append(" ");
			first = false;
			visit(key, depth + 1);
			append("=");
			try {
				visit((field as Record<string, unknown>)[key], depth + 1);
			} catch {
				append("<unavailable>");
			}
		}
		if (depth > 0) append("}");
		ancestors.delete(field);
	};
	try {
		visit(value, 0);
	} catch {
		append("<unavailable>");
	}
	if (remaining === 0) parts.push("<truncated: 100000 character limit>");
	return parts.join("");
}

export class EventLogClient {
	private initialized = false;
	private recording = false;
	private pendingQuests = false;
	private offeredQuest = "questID=<unavailable>";
	constructor(
		private readonly diagnostics: Diagnostics,
		private readonly context: { capture(): ErrorEnvironment },
	) {}
	initialize(): void {
		if (this.initialized) return;
		// Declining has no native event. A secure post-hook observes both our UI
		// and Blizzard's without replacing the protected function.
		this.record(() => {
			hooksecurefunc("DeclineQuest", () =>
				this.record(() => this.write("quest declined", this.offeredQuest)),
			);
			this.initialized = true;
		});
	}
	application(event: string, payload?: unknown): void {
		this.record(() =>
			this.write(
				`event ${event}`,
				!secret(payload) && payload === undefined ? "" : describe(payload),
			),
		);
	}
	native(event: string, args: readonly unknown[]): void {
		this.record(() => this.recordNative(event, args));
	}
	private record(record: () => void): void {
		if (this.recording) return;
		this.recording = true;
		try {
			record();
		} catch {
			// Never feed failures in logging back into the error grabber.
		} finally {
			this.recording = false;
		}
	}
	private recordNative(event: string, args: readonly unknown[]): void {
		const fields = args.map(
			(value, index) =>
				`${nativeFields[event]?.at(index) ?? `arg${index + 1}`}=${describe(value)}`,
		);
		const dialogue =
			event.startsWith("GOSSIP_") ||
			[
				"QUEST_GREETING",
				"QUEST_DETAIL",
				"QUEST_PROGRESS",
				"QUEST_COMPLETE",
				"QUEST_FINISHED",
				"MERCHANT_SHOW",
				"PLAYER_INTERACTION_MANAGER_FRAME_SHOW",
			].includes(event);
		if (dialogue || event === "PLAYER_TARGET_CHANGED") {
			for (const unit of ["target", "npc"])
				fields.push(
					this.read(`${unit}Name`, () => {
						const [name] = (
							UnitName as unknown as (
								this: void,
								unit: string,
							) => LuaMultiReturn<[string | undefined, string | undefined]>
						)(unit);
						return name;
					}),
					this.read(`${unit}GUID`, () =>
						(
							UnitGUID as unknown as (
								this: void,
								unit: string,
							) => string | undefined
						)(unit),
					),
				);
		}
		if (["QUEST_DETAIL", "QUEST_PROGRESS", "QUEST_COMPLETE"].includes(event)) {
			const quest = `${this.read("questID", () => GetQuestID())} ${this.read("questTitle", () => GetTitleText())}`;
			fields.push(quest);
			this.offeredQuest = quest;
		}
		if (
			[
				"QUEST_ACCEPTED",
				"QUEST_REMOVED",
				"QUEST_TURNED_IN",
				"QUEST_WATCH_UPDATE",
				"QUEST_AUTOCOMPLETE",
			].includes(event)
		) {
			const id = args.at(0);
			if (!secret(id) && typeof id === "number")
				fields.push(
					this.read("questTitle", () => C_QuestLog.GetTitleForQuestID(id)),
				);
		}
		const world =
			event === "PLAYER_LOGIN" ||
			event === "PLAYER_ENTERING_WORLD" ||
			event.startsWith("ZONE_CHANGED") ||
			event.startsWith("GROUP_") ||
			event.startsWith("LFG_") ||
			event.startsWith("ENCOUNTER_") ||
			event.startsWith("CHALLENGE_MODE_") ||
			event.startsWith("ADDON_") ||
			event.startsWith("PLAYER_REGEN_") ||
			event === "PLAYER_DIFFICULTY_CHANGED";
		if (world) {
			try {
				const environment = this.context.capture();
				// Environment is already sanitized by the context client.
				for (const [key, value] of Object.entries(environment.details))
					fields.push(`${key}=${describe(value)}`);
				if (environment.unavailableFields.length > 0)
					fields.push(`unavailable=${environment.unavailableFields.join(",")}`);
			} catch {
				fields.push("environment=<unavailable>");
			}
		}
		this.write(`native ${event}`, fields.join(" "));
		if (event === "PLAYER_LOGIN") this.pendingQuests = true;
		if (
			this.pendingQuests &&
			["PLAYER_LOGIN", "PLAYER_ENTERING_WORLD", "QUEST_LOG_UPDATE"].includes(
				event,
			)
		)
			this.snapshotQuests();
	}
	private read(field: string, read: () => unknown): string {
		try {
			return `${field}=${describe(read())}`;
		} catch {
			return `${field}=<unavailable>`;
		}
	}
	private write(label: string, payload: string): void {
		// Diagnostics caps individual lines at 12k. Split large payloads so the
		// saved event log retains the full dump, with ordered continuation parts.
		if (payload.length <= 10000) {
			this.diagnostics.log(
				"info",
				`${label}${payload.length > 0 ? ` ${payload}` : ""}`,
			);
			return;
		}
		for (let offset = 0; offset < payload.length; offset += 10000)
			this.diagnostics.log(
				"info",
				`${label} part=${offset / 10000 + 1}/${Math.ceil(payload.length / 10000)} ${payload.slice(offset, offset + 10000)}`,
			);
	}
	private snapshotQuests(): void {
		try {
			const [count, quests] = C_QuestLog.GetNumQuestLogEntries();
			if (secret(count) || secret(quests)) return;
			this.diagnostics.log(
				"info",
				`quest snapshot entries=${count} quests=${quests}`,
			);
			if (count === 0) return; // Login can precede the first populated quest log.
			for (let index = 1; index <= count; index++) {
				const info = (
					C_QuestLog.GetInfo as unknown as (
						this: void,
						index: number,
					) => QuestInfo | undefined
				)(index);
				if (secret(info) || !info || secret(info.isHeader) || info.isHeader)
					continue;
				this.write(`quest snapshot index=${index}`, describe(info));
			}
			this.pendingQuests = false;
		} catch {
			this.diagnostics.log(
				"info",
				"quest snapshot <unavailable>; awaiting quest log update",
			);
		}
	}
}
