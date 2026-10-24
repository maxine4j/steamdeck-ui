import type { IDialogueCamera } from "../../clients/dialogue-camera";
import type {
	DialogueKind,
	DialoguePage,
	DialoguePrompt,
	DialogueResult,
	IDialogueClient,
} from "../../clients/dialogue-client";
import { dialogueMoney } from "../../clients/dialogue-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import type {
	ApplicationEvent,
	EventHandler,
	IEventBus,
} from "../../events/types";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { IModule } from "../types";

export interface DialogueDisplay {
	readonly page: DialoguePage;
	readonly selected?: number;
	readonly confirmation?: { readonly text: string; readonly code: boolean };
	readonly feedback?: string;
	readonly suspended: boolean;
	readonly waiting: boolean;
	readonly resetReading: boolean;
}
export interface DialogueActions {
	select(page: DialoguePage, id: string): void;
	choose(page: DialoguePage, index: number): void;
	primary(page: DialoguePage): void;
	confirm(page: DialoguePage, code?: string): void;
	cancel(): void;
}
export interface IDialogueView {
	setActions(actions: DialogueActions): void;
	show(display: DialogueDisplay): void;
	hide(): void;
}
export interface IBuiltInDialogue {
	disable(): void;
	refresh(): void;
	restore(): void;
}

export class DialogueModule implements IModule, DialogueActions {
	readonly id = "npc-dialogue";
	page?: DialoguePage;
	selectedReward?: number;
	private active = false;
	private armed = false;
	private waiting = false;
	private suspended = false;
	private confirmation?: {
		text: string;
		code: boolean;
		action: "gossip" | "accept" | "claim";
	};
	private feedback?: string;
	private cancelRender?: () => void;
	private cancelEnd?: () => void;
	private resetReading = false;
	private readonly remoteQuests: number[] = [];
	private readonly subscriptions: [ApplicationEvent, EventHandler][] = [];
	constructor(
		private readonly client: IDialogueClient,
		private readonly events: IEventBus,
		private readonly scheduler: ITaskScheduler,
		private readonly view: IDialogueView,
		private readonly ui: Pick<IUIOrchestrator, "openPanel" | "closePanel">,
		private readonly native: IBuiltInDialogue,
		private readonly camera: IDialogueCamera,
	) {
		view.setActions(this);
	}
	disableBuiltIn(): void {
		this.native.disable();
	}
	private listen<E extends ApplicationEvent>(
		event: E,
		handler: EventHandler<E>,
	): void {
		this.events.subscribe(event, handler);
		this.subscriptions.push([event, handler as EventHandler]);
	}
	initialize(): void {
		this.active = true;
		this.suspended = this.client.isInCombat();
		this.listen("GOSSIP_SHOW", () => this.transition("gossip"));
		this.listen("QUEST_GREETING", () => this.transition("greeting"));
		this.listen("QUEST_DETAIL", (p) => this.transition("offer", p.startItem));
		this.listen("QUEST_PROGRESS", () => this.transition("progress"));
		this.listen("QUEST_COMPLETE", () => this.transition("rewards"));
		this.listen("GOSSIP_CLOSED", (p) => {
			this.confirmation = undefined;
			this.client.cancelPrompt();
			if (!p.continuing && this.page?.kind === "gossip") this.finish();
		});
		this.listen("QUEST_FINISHED", () => {
			if (
				this.page &&
				this.page.kind !== "gossip" &&
				this.page.kind !== "remote"
			)
				this.finish();
		});
		this.listen("GOSSIP_CONFIRM", (p) => this.prompt({ kind: "gossip", ...p }));
		this.listen("GOSSIP_ENTER_CODE", (p) =>
			this.prompt({ kind: "code", ...p, text: "Enter code", cost: 0 }),
		);
		this.listen("GOSSIP_CONFIRM_CANCEL", () => {
			this.confirmation = undefined;
			this.client.cancelPrompt();
			this.waiting = false;
			this.render();
		});
		this.listen("GOSSIP_OPTIONS_REFRESHED", () => {
			if (this.page?.kind === "gossip") {
				this.waiting = false;
				this.client.cancelPrompt();
				this.refresh();
			}
		});
		this.listen("QUEST_ITEM_UPDATE", () => this.refresh());
		this.listen("ITEM_DATA_LOAD_RESULT", () => this.refresh());
		this.listen("QUEST_LOG_UPDATE", () => {
			if (
				this.page?.kind === "greeting" ||
				this.page?.kind === "progress" ||
				this.page?.kind === "shared"
			)
				this.refresh();
		});
		this.listen("PLAYER_MONEY", () => this.refresh());
		this.listen("QUEST_AUTOCOMPLETE", (p) => {
			if (!this.page) this.transition("remote", undefined, p.questID);
			else if (
				!("questID" in this.page && this.page.questID === p.questID) &&
				!this.remoteQuests.includes(p.questID)
			)
				this.remoteQuests.push(p.questID);
		});
		this.listen("QUEST_ACCEPT_CONFIRM", (p) =>
			this.transition("shared", undefined, p.questID, p.speaker, p.title),
		);
		this.listen("COMBAT_STARTED", () => {
			this.suspended = true;
			this.armed = false;
			this.confirmation = undefined;
			this.client.cancelPrompt();
			this.camera.end();
			this.render();
		});
		this.listen("COMBAT_ENDED", () => {
			this.suspended = false;
			if (this.page) {
				this.waiting = false;
				this.refresh();
				this.camera.begin(this.isNPC(this.page));
			}
		});
		this.listen("DIALOGUE_WORLD_RESET", () => {
			this.remoteQuests.length = 0;
			this.finish(true);
		});
		this.listen("DIALOGUE_ADDON_LOADED", () => this.native.refresh());
		this.listen("DIALOGUE_INTERACTION_SHOWN", (p) => {
			if (this.page && !this.client.isDialogueInteraction(p.interactionType))
				this.finish(true);
		});
		this.listen("DIALOGUE_ERROR", (p) => {
			if (this.page) {
				this.waiting = false;
				this.confirmation = undefined;
				this.client.cancelPrompt();
				this.feedback = p.message;
				this.refresh();
			}
		});
	}
	private isNPC(page: DialoguePage): boolean {
		return !!page.source && !(page.kind === "offer" && page.startItem);
	}
	private transition(
		kind: DialogueKind,
		startItem?: number,
		questID?: number,
		speaker?: string,
		title?: string,
	): void {
		this.cancelEnd?.();
		this.cancelEnd = undefined;
		const previous = this.page;
		this.page = this.client.read(kind, startItem, questID, speaker, title);
		this.confirmation = undefined;
		this.feedback = undefined;
		this.waiting = false;
		this.selectedReward =
			this.page.kind === "rewards" && this.page.choices.length === 1
				? this.page.choices.at(0)?.index
				: undefined;
		this.resetReading = true;
		this.armed = false;
		if (previous && previous.source !== this.page.source) this.camera.end();
		if (!this.suspended) this.camera.begin(this.isNPC(this.page));
		this.render();
	}
	private refresh(): void {
		const page = this.page;
		if (!page || !this.active || this.confirmation) return;
		const refreshed = this.client.refresh(page);
		if (!refreshed) return;
		if (
			refreshed.session !== page.session ||
			("questID" in refreshed &&
				"questID" in page &&
				refreshed.questID !== page.questID)
		) {
			this.selectedReward = undefined;
			this.resetReading = true;
		}
		this.page = refreshed;
		this.render();
	}
	private render(): void {
		this.cancelRender?.();
		this.armed = false;
		this.cancelRender = this.scheduler.nextFrame(() => {
			this.cancelRender = undefined;
			if (!this.active || !this.page) return;
			this.view.show({
				page: this.page,
				selected: this.selectedReward,
				confirmation: this.confirmation,
				feedback: this.feedback,
				suspended: this.suspended,
				waiting: this.waiting,
				resetReading: this.resetReading,
			});
			this.resetReading = false;
			this.ui.openPanel(this.id, "fullscreen");
			this.armed = !this.suspended && !this.waiting;
		});
	}
	private usable(page: DialoguePage): boolean {
		return (
			this.active &&
			this.armed &&
			!this.suspended &&
			!this.client.isInCombat() &&
			this.page === page
		);
	}
	private result(result: DialogueResult, page: DialoguePage): void {
		// A synchronous event may already have replaced the page.
		if (this.page !== page) return;
		if (result.ok && this.confirmation) return;
		if (result.ok) {
			this.waiting = true;
			this.feedback = "Waiting for the game…";
		} else {
			this.feedback = result.reason ?? "Action unavailable.";
			this.waiting = false;
			this.client.cancelPrompt();
			this.page = this.client.refresh(page) ?? page;
			if (
				this.page.kind === "rewards" &&
				!this.page.choices.some((c) => c.index === this.selectedReward)
			)
				this.selectedReward = undefined;
		}
		this.render();
	}
	select(page: DialoguePage, id: string): void {
		if (this.usable(page) && !this.confirmation)
			this.result(this.client.select(page, id), page);
	}
	choose(page: DialoguePage, index: number): void {
		if (
			!this.usable(page) ||
			this.confirmation ||
			page.kind !== "rewards" ||
			!page.choices.some((c) => c.index === index)
		)
			return;
		this.selectedReward = index;
		this.render();
	}
	primary(page: DialoguePage): void {
		if (!this.usable(page) || this.confirmation) return;
		if (page.kind === "offer" || page.kind === "shared") {
			if (page.kind === "offer" && page.pvp && !page.autoAccepted) {
				this.confirmation = {
					text: "Accepting this quest flags you for PvP. Accept?",
					code: false,
					action: "accept",
				};
				this.render();
			} else this.result(this.client.accept(page), page);
		} else if (page.kind === "progress" || page.kind === "remote")
			this.result(this.client.advance(page), page);
		else if (page.kind === "rewards") {
			if (page.choices.length > 1 && this.selectedReward === undefined) {
				this.feedback = "Select a reward first.";
				this.render();
				return;
			}
			this.confirmation = {
				text:
					page.cost > 0
						? `Claim rewards for ${dialogueMoney(page.cost)}?`
						: "Claim these quest rewards?",
				code: false,
				action: "claim",
			};
			this.render();
		}
	}
	private prompt(prompt: DialoguePrompt): void {
		if (!this.page || this.suspended || this.page.kind !== "gossip") return;
		this.client.prompt(this.page, prompt);
		this.waiting = false;
		this.confirmation = {
			text:
				prompt.cost > 0
					? `${prompt.text}\nCost: ${dialogueMoney(prompt.cost)}`
					: prompt.text,
			code: prompt.kind === "code",
			action: "gossip",
		};
		this.render();
	}
	confirm(page: DialoguePage, code?: string): void {
		if (!this.usable(page) || !this.confirmation) return;
		const action = this.confirmation.action;
		this.confirmation = undefined;
		const result =
			action === "gossip"
				? this.client.confirm(page, code)
				: action === "accept"
					? this.client.accept(page, true)
					: this.client.claim(page, this.selectedReward, true);
		this.result(result, page);
	}
	cancel(): void {
		if (!this.page || this.suspended || this.client.isInCombat()) return;
		if (this.confirmation) {
			this.confirmation = undefined;
			this.client.cancelPrompt();
			this.feedback = undefined;
			this.waiting = false;
			this.render();
			return;
		}
		this.client.close(this.page);
		this.finish(true);
	}
	private finish(immediate = false): void {
		// Invalidate actions and opaque NPC identity now; only defer visual cleanup.
		this.client.end();
		this.page = undefined;
		this.selectedReward = undefined;
		this.confirmation = undefined;
		this.armed = false;
		this.cancelRender?.();
		this.cancelRender = undefined;
		this.cancelEnd?.();
		const end = () => {
			this.cancelEnd = undefined;
			if (this.page) return;
			this.camera.end();
			this.view.hide();
			this.ui.closePanel("fullscreen", this.id);
			const remote = this.active ? this.remoteQuests.shift() : undefined;
			if (remote !== undefined) this.transition("remote", undefined, remote);
		};
		if (immediate) end();
		else this.cancelEnd = this.scheduler.nextFrame(end);
	}
	shutdown(): void {
		this.active = false;
		this.remoteQuests.length = 0;
		this.finish(true);
		for (const [event, handler] of this.subscriptions)
			this.events.unsubscribe(event, handler);
		this.subscriptions.length = 0;
		this.native.restore();
	}
}
