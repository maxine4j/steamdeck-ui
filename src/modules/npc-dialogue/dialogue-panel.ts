import type { DialogueEntry } from "../../clients/dialogue-client";
import { controllerIcon } from "../../ui/components/controller-icon";
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

const dialogueArt = "Interface\\AddOns\\SteamDeckUI\\assets\\dialogue\\";

/** Feature-owned transient content; the fullscreen host supplies lifecycle only. */
export class DialoguePanel implements IPanel, IDialogueView {
	readonly id = "npc-dialogue";
	readonly title = "Conversation";
	private readonly window: Frame;
	private readonly surface: Frame;
	private readonly divider: Frame;
	private readonly readingHost: Frame;
	private readonly choicesHost: Frame;
	private readonly input: Frame;
	private readonly reading: ScrollText;
	private readonly choices: ScrollList;
	private display?: DialogueDisplay;
	private actions?: DialogueActions;
	private mounted = false;
	private focusFirst = true;
	private code = "";
	private readingWidth = 480;
	private height = 620;
	private navigationChanged?: () => void;
	private readonly ink = [0.7, 0.7, 0.7] as const;
	private readonly headingColor = [0.9, 0.9, 0.9] as const;
	private readonly optionColor = [0.796, 0.784, 0.584] as const;
	constructor(
		pool: IFramePoolManager,
		private readonly navigation: IModalNavigation,
	) {
		this.window = new Frame("dialogue-window", pool);
		this.surface = new Frame("dialogue-surface", pool);
		this.divider = new Frame("dialogue-divider", pool);
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
				textColor: this.optionColor,
				background: false,
				autoHeight: true,
				onChanged: (complete) => {
					if (complete) {
						this.layoutBody();
						this.syncNavigation();
					}
				},
			},
		);
	}
	setActions(actions: DialogueActions): void {
		this.actions = actions;
	}
	show(display: DialogueDisplay): void {
		const promptChanged = this.display?.confirmation !== display.confirmation;
		if (
			promptChanged ||
			display.resetReading ||
			this.display?.page.session !== display.page.session ||
			this.display?.page.kind !== display.page.kind
		)
			this.focusFirst = true;
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
		this.focusFirst = true;
		if (!(parent instanceof Frame))
			throw new Error("Dialogue requires a frame parent");
		const available = parent.getSize();
		const width = Math.min(520, available.width * 0.44);
		const height = Math.min(620, available.height - 80);
		this.height = height;
		this.window.setParent(parent);
		this.window.layout(width, height, "RIGHT", parent, -32, 0);
		this.window.setWindowBackground();
		this.surface.inset(this.window, 12, 12, 12, 12);
		this.surface.show();
		this.divider.setParent(this.surface);
		this.divider.setColor(0.35, 0.35, 0.35, 1);
		this.divider.show();
		this.readingWidth = width - 56;
		this.readingHost.setParent(this.surface);
		this.choicesHost.setParent(this.surface);
		this.choices.setWidth(this.readingWidth);
		this.input.setParent(this.surface);
		this.input.setInsetBackground();
		this.input.setFocusBorder(true);
		this.input.configureInput((text) => {
			this.code = text;
		});
		this.readingHost.show();
		this.choicesHost.show();
		this.window.show();
		this.mounted = true;
		this.choices.mount(this.choicesHost);
		this.render();
	}
	private render(): void {
		const display = this.display;
		if (!display || !this.mounted) return;
		const page = display.page;
		this.surface.setLabel(
			"speaker",
			page.speaker,
			"TOPLEFT",
			16,
			-6,
			16,
			this.readingWidth,
		);
		this.surface.setLabel(
			"title",
			page.title,
			"TOPLEFT",
			16,
			-32,
			22,
			this.readingWidth,
		);
		this.surface.setLabelStyle("speaker", this.headingColor);
		this.surface.setLabelStyle("title", this.headingColor);
		this.surface.setLabelWordWrap("title", false);
		this.surface.setLabel(
			"hint",
			display.suspended
				? "Dialogue paused during combat. Actions resume after combat."
				: (display.feedback ??
						`${controllerIcon("D-pad")} Focus · ${controllerIcon("A")} Select · ${controllerIcon("B")} Cancel / Close`),
			"BOTTOMLEFT",
			16,
			4,
			12,
			this.readingWidth,
		);
		this.surface.setLabelStyle("hint", this.ink);
		this.surface.setLabelWordWrap("hint", true);
		const rows: ListRow[] = [];
		const enabled = !display.suspended && !display.waiting;
		const add = (
			entry: DialogueEntry,
			activate: () => void,
			selected = false,
			reward = false,
		): void => {
			const speech =
				(page.kind === "gossip" || page.kind === "greeting") &&
				(entry.icon === 132053 || entry.icon === 1019848);
			let icon: number | string | undefined = speech
				? `${dialogueArt}Gossip.png`
				: entry.icon;
			if (entry.id === "dialogue-confirm")
				icon = `${dialogueArt}CompleteQuest.png`;
			if (entry.id === "dialogue-primary") {
				const marker =
					page.kind === "offer" || page.kind === "shared"
						? "AvailableQuest"
						: page.kind === "progress" && !page.completable
							? "IncompleteQuest"
							: "CompleteQuest";
				icon = `${dialogueArt}${marker}.png`;
			}
			if (page.kind === "gossip" || page.kind === "greeting") {
				if (
					entry.id.startsWith("available:") ||
					entry.id.startsWith("greeting-available:")
				)
					icon = `${dialogueArt}AvailableQuest.png`;
				if (
					entry.id.startsWith("active:") ||
					entry.id.startsWith("greeting-active:")
				)
					icon = `${dialogueArt}${entry.detail === "Complete" ? "CompleteQuest" : "IncompleteQuest"}.png`;
			}
			rows.push({
				...entry,
				label:
					entry.id === "dialogue-cancel"
						? `|T${dialogueArt}CloseButton.png:24:24:0:0:256:128:16:48:80:112|t ${entry.label}`
						: entry.label,
				icon,
				iconSize: typeof icon === "string" ? 24 : undefined,
				fullWidth: !reward,
				height: reward ? 70 : undefined,
				wrapLabel: true,
				selected,
				fontSize: 17,
				background: selected ? [0.24, 0.22, 0.14] : false,
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
						detail: `${controllerIcon("A")} Focus · ${controllerIcon("Steam")}+${controllerIcon("X")} Keyboard`,
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
						false,
						true,
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
						true,
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
		this.choices.setColumns(
			!display.confirmation &&
				(page.kind === "offer" || page.kind === "rewards")
				? 2
				: 1,
		);
		this.choices.setRows(rows);
		this.layoutBody();
		this.reading.setText(
			display.confirmation?.text ?? page.text,
			display.resetReading,
		);
		this.syncNavigation(this.focusFirst);
		this.focusFirst = false;
	}
	private layoutBody(): void {
		const display = this.display;
		if (!this.mounted || !display) return;
		const inputHeight = display.confirmation?.code ? 52 : 0;
		const minimumReader = Math.ceil(this.height / 3);
		const available = this.height - 96 - 64 - 24 - inputHeight;
		const choicesHeight = Math.min(
			this.choices.getContentHeight(),
			available - minimumReader,
		);
		const readerHeight = available - choicesHeight;
		const choicesTop = this.height - 64 - choicesHeight;
		this.choicesHost.layout(
			this.readingWidth,
			choicesHeight,
			"BOTTOMLEFT",
			this.window,
			28,
			64,
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
		this.reading.setText(
			display.confirmation?.text ?? display.page.text,
			false,
		);
		this.divider.layout(
			this.readingWidth,
			1,
			"TOPLEFT",
			this.window,
			28,
			-(choicesTop - 16),
		);
		this.input.layout(
			this.readingWidth,
			40,
			"TOPLEFT",
			this.window,
			28,
			-(choicesTop - 52),
		);
	}
	getNavGrid(): NavGrid {
		if (!this.mounted || !this.display) return [];
		return this.choices.getNavGrid();
	}
	private syncNavigation(focusFirst = false): void {
		if (!this.mounted || !this.display) return;
		const grid = this.getNavGrid();
		this.navigation.pushModal(
			this.id,
			grid,
			() => this.actions?.cancel(),
			focusFirst ? grid.at(0)?.at(0)?.navId : undefined,
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
		this.divider.destroy();
		this.input.destroy();
		this.readingHost.destroy();
		this.choicesHost.destroy();
		this.surface.destroy();
		this.window.destroy();
	}
}
