import type { DialogueEntry } from "../../clients/dialogue-client";
import { Frame } from "../../ui/components/frame";
import type { IModalNavigation } from "../../ui/components/modal";
import { type ListRow, ScrollList } from "../../ui/components/scroll-list";
import { ScrollText } from "../../ui/components/scroll-text";
import type { IUIComponent } from "../../ui/components/types";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { NavGrid } from "../../ui/navigation/types";
import type { IPanel } from "../../ui/panel/types";
import type {
	DialogueActions,
	DialogueDisplay,
	IDialogueView,
} from "./dialogue-module";

/** Feature-owned transient content; the fullscreen host supplies lifecycle only. */
export class DialoguePanel implements IPanel, IDialogueView {
	readonly id = "npc-dialogue";
	readonly title = "Conversation";
	private readonly window: Frame;
	private readonly readingHost: Frame;
	private readonly choicesHost: Frame;
	private readonly input: Frame;
	private readonly reading: ScrollText;
	private readonly choices: ScrollList;
	private display?: DialogueDisplay;
	private actions?: DialogueActions;
	private mounted = false;
	private code = "";
	private readingWidth = 480;
	private readingHeight = 430;
	private height = 620;
	private navigationChanged?: () => void;
	private readonly ink = [0.19, 0.17, 0.13] as const;
	constructor(
		pool: IFramePoolManager,
		private readonly navigation: IModalNavigation,
	) {
		this.window = new Frame("dialogue-window", pool);
		this.readingHost = new Frame("dialogue-reading-host", pool);
		this.choicesHost = new Frame("dialogue-choices-host", pool);
		this.input = new Frame("dialogue-code", pool, "EditBox");
		this.reading = new ScrollText("dialogue-reading", pool, {
			showPosition: false,
			textColor: this.ink,
		});
		this.choices = new ScrollList(
			"dialogue-choices",
			pool,
			"",
			() => this.actions?.cancel(),
			{
				width: 464,
				padding: 0,
				top: 0,
				bottom: 0,
				gap: 6,
				contentPadding: { horizontal: 12, vertical: 10 },
				centerSingleLine: true,
				textColor: this.ink,
				background: false,
				autoHeight: true,
				onChanged: (complete) => {
					if (complete) this.syncNavigation();
				},
			},
		);
	}
	setActions(actions: DialogueActions): void {
		this.actions = actions;
	}
	show(display: DialogueDisplay): void {
		const promptChanged = this.display?.confirmation !== display.confirmation;
		if (promptChanged && display.confirmation?.code) {
			this.code = "";
			if (this.mounted) this.input.clearInput();
		}
		if (!display.confirmation?.code && this.display?.confirmation?.code) {
			this.input.clearInput();
			this.code = "";
		}
		this.display = promptChanged ? { ...display, resetReading: true } : display;
		if (this.mounted) this.render();
	}
	hide(): void {
		this.display = undefined;
	}
	onMount(parent: IUIComponent): void {
		if (!(parent instanceof Frame))
			throw new Error("Dialogue requires a frame parent");
		const available = parent.getSize();
		const width = Math.min(520, available.width * 0.44);
		const height = Math.min(620, available.height - 80);
		this.height = height;
		this.window.setParent(parent);
		this.window.layout(width, height, "RIGHT", parent, -32, 0);
		this.window.setAtlasBackground("QuestBG-Parchment");
		this.readingWidth = width - 56;
		this.readingHeight = Math.floor((height - 180) * 0.45);
		this.readingHost.setParent(this.window);
		this.readingHost.layout(
			this.readingWidth,
			this.readingHeight,
			"TOPLEFT",
			this.window,
			28,
			-96,
		);
		this.choicesHost.setParent(this.window);
		this.choices.setWidth(this.readingWidth);
		this.input.setParent(this.window);
		this.input.setInsetBackground();
		this.input.setFocusBorder(true);
		this.input.configureInput((text) => {
			this.code = text;
		});
		this.readingHost.show();
		this.choicesHost.show();
		this.window.show();
		this.mounted = true;
		this.reading.mount(this.readingHost, this.readingWidth, this.readingHeight);
		this.choices.mount(this.choicesHost);
		this.render();
	}
	private render(): void {
		const display = this.display;
		if (!display || !this.mounted) return;
		const page = display.page;
		this.window.setLabel(
			"speaker",
			page.speaker,
			"TOPLEFT",
			28,
			-18,
			16,
			this.readingWidth,
		);
		this.window.setLabel(
			"title",
			page.title,
			"TOPLEFT",
			28,
			-44,
			22,
			this.readingWidth,
		);
		this.window.setLabelStyle("speaker", this.ink);
		this.window.setLabelStyle("title", this.ink);
		this.window.setLabelWordWrap("title", false);
		const text = display.confirmation?.text ?? page.text;
		this.reading.setText(text, display.resetReading);
		// Short conversations leave more room for choices; long prose keeps its own reader.
		const readerHeight = Math.min(
			this.readingHeight,
			Math.max(48, this.reading.getTextHeight()),
		);
		this.readingHost.layout(
			this.readingWidth,
			readerHeight,
			"TOPLEFT",
			this.window,
			28,
			-96,
		);
		this.reading.mount(this.readingHost, this.readingWidth, readerHeight);
		this.reading.setText(text, false);
		this.window.setLabel(
			"hint",
			display.suspended
				? "Dialogue paused during combat. Actions resume after combat."
				: (display.feedback ??
						"D-pad: Focus · A: Select / Read · Y: Read up · B: Cancel / Close"),
			"BOTTOMLEFT",
			28,
			16,
			12,
			this.readingWidth,
		);
		this.window.setLabelStyle("hint", this.ink);
		this.window.setLabelWordWrap("hint", true);
		const rows: ListRow[] = [];
		const enabled = !display.suspended && !display.waiting;
		const choicesTop =
			96 + readerHeight + 16 + (display.confirmation?.code ? 52 : 0);
		this.choicesHost.layout(
			this.readingWidth,
			this.height - choicesTop - 64,
			"TOPLEFT",
			this.window,
			28,
			-choicesTop,
		);
		this.input.layout(
			this.readingWidth,
			40,
			"TOPLEFT",
			this.window,
			28,
			-(choicesTop - 52),
		);
		const add = (
			entry: DialogueEntry,
			activate: () => void,
			selected = false,
		): void => {
			rows.push({
				...entry,
				selected,
				fontSize: 17,
				background: selected ? [0.67, 0.56, 0.36] : false,
				detail: entry.detail,
				tooltipContent: entry.tooltipLink,
				activate: () => {
					if (enabled) activate();
				},
			});
		};
		const heading = (id: string, label: string): void => {
			rows.push({
				id,
				label,
				heading: true,
				background: false,
				fontSize: 18,
				marginTop: 12,
				activate: () => {},
			});
		};
		if (display.confirmation) {
			if (display.confirmation.code) {
				this.input.show();
				add(
					{
						id: "dialogue-input",
						label: "Enter code",
						detail: "A: Focus · Steam+X: Keyboard",
					},
					() => this.input.focusInput(),
				);
			} else this.input.hide();
			add({ id: "dialogue-confirm", label: "Confirm" }, () =>
				this.actions?.confirm(page, this.code),
			);
		} else {
			this.input.hide();
			if (page.kind === "gossip" || page.kind === "greeting")
				for (const entry of page.entries)
					add(entry, () => this.actions?.select(page, entry.id));
			if (page.kind === "progress") {
				if (page.requirements.length > 0)
					heading("requirements-heading", "Required items");
				for (const entry of page.requirements) add(entry, () => {});
				add(
					{
						id: "dialogue-primary",
						label: "Continue",
						detail: page.completable ? undefined : "Requirements are not met",
						disabled: !page.completable,
					},
					() => this.actions?.primary(page),
				);
			}
			if (page.kind === "offer" || page.kind === "rewards") {
				if (page.rewards.length > 0) heading("rewards-heading", "Rewards");
				for (const reward of page.rewards)
					add(
						{ ...reward, detail: reward.detail ?? "Guaranteed reward" },
						() => {},
					);
				if (page.choices.length > 0)
					heading(
						"choices-heading",
						page.kind === "offer"
							? "Choose on completion"
							: "Choose one reward",
					);
				for (const choice of page.choices)
					add(
						{
							...choice,
							label: `${choice.index === display.selected ? "✓ " : ""}${choice.label}`,
							detail: choice.detail,
						},
						() => {
							if (page.kind === "rewards" && choice.index !== undefined)
								this.actions?.choose(page, choice.index);
						},
						choice.index === display.selected,
					);
				add(
					{
						id: "dialogue-primary",
						label:
							page.kind === "offer"
								? page.autoAccepted
									? "Acknowledge"
									: "Accept quest"
								: "Claim rewards",
						detail:
							page.kind === "rewards" &&
							page.choices.length > 1 &&
							display.selected === undefined
								? "Select a reward first"
								: undefined,
					},
					() => this.actions?.primary(page),
				);
			}
			if (page.kind === "remote" || page.kind === "shared")
				add(
					{
						id: "dialogue-primary",
						label:
							page.kind === "remote" ? "Review rewards" : "Accept shared quest",
						disabled: page.kind === "shared" && !page.eligible,
						detail:
							page.kind === "shared" && !page.eligible
								? "Quest log is full"
								: undefined,
					},
					() => this.actions?.primary(page),
				);
		}
		add(
			{
				id: "dialogue-cancel",
				label: display.confirmation
					? "Cancel"
					: page.kind === "offer" && !page.autoAccepted
						? "Decline"
						: "Close",
			},
			() => this.actions?.cancel(),
		);
		this.choices.setRows(rows);
		this.syncNavigation();
	}
	getNavGrid(): NavGrid {
		if (!this.mounted || !this.display) return [];
		const choices = this.choices.getNavGrid();
		return [[this.reading.node], ...choices];
	}
	private syncNavigation(): void {
		if (!this.mounted || !this.display) return;
		this.navigation.pushModal(this.id, this.getNavGrid(), () =>
			this.actions?.cancel(),
		);
		this.navigationChanged?.();
	}
	setNavigationChanged(callback?: () => void): void {
		this.navigationChanged = callback;
	}
	onUnmount(): void {
		this.mounted = false;
		this.input.clearInput();
		this.code = "";
		this.navigation.popModal(this.id);
		this.reading.unmount();
		this.choices.unmount();
		this.window.hide();
	}
	destroy(): void {
		if (this.mounted) this.onUnmount();
		this.reading.destroy();
		this.choices.destroy();
		this.input.destroy();
		this.readingHost.destroy();
		this.choicesHost.destroy();
		this.window.destroy();
	}
}
