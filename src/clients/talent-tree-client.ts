import type { IEventBus } from "../events/types";
import type { NativeTalentButton } from "../modules/talents/wow-talents-globals";
import type { Frame } from "../ui/components/frame";
import type { NativeLayout } from "../ui/components/native-layout";
import type { NativeNavigation } from "../ui/components/native-navigation";
import type { NavGrid } from "../ui/navigation/types";

export interface ITalentTreeClient {
	mount(parent: Frame): void;
	resize(): void;
	unmount(): void;
	navigation(): NavGrid;
	dismissChoices(): boolean;
}

export class TalentTreeClient implements ITalentTreeClient {
	private parent?: Frame;
	private hooked = false;
	private focused?: NativeTalentButton;
	private size?: readonly [number, number];
	private scale = 1;
	private heroCollapsed?: boolean;
	private readonly changed = () => {
		if (!this.parent) return;
		PlayerSpellsFrame?.TalentsFrame.HeroTalentsContainer.SetCollapsed(
			false,
			true,
		);
		this.events.emit("TALENTS_CHANGED");
	};
	constructor(
		private readonly native: {
			openFull(): void;
			close(): void;
			isFullOpen(): boolean;
		},
		private readonly layout: NativeLayout,
		private readonly focus: NativeNavigation,
		private readonly events: IEventBus,
	) {}
	mount(parent: Frame): void {
		this.native.openFull();
		const frame = PlayerSpellsFrame;
		if (!frame) return;
		this.parent = parent;
		const [width, height] = frame.GetSize();
		this.size = [width, height];
		this.scale = frame.GetScale();
		const tree = frame.TalentsFrame;
		this.heroCollapsed = tree.HeroTalentsContainer.isCollapsed;
		if (!this.hooked) {
			// Hook the rebuild method, rather than adding an always-running OnUpdate script.
			hooksecurefunc(tree, "OnUpdate", () => this.changed());
			tree.SelectionChoiceFrame.HookScript("OnShow", this.changed);
			tree.SelectionChoiceFrame.HookScript("OnHide", this.changed);
			this.hooked = true;
		}
		// Keep every hero node visible without changing the player's saved collapse preference.
		tree.HeroTalentsContainer.SetCollapsed(false, true);
		this.resize();
	}
	resize(): void {
		const parent = this.parent;
		const frame = PlayerSpellsFrame;
		if (!parent || !frame || !this.size) return;
		const available = parent.getSize();
		const [width, height] = this.size;
		this.layout.bind(frame, {
			parent,
			reparent: true,
			anchors: [["CENTER", "CENTER", 0, 0]],
			size: [width, height],
			scale: Math.min(
				this.scale,
				available.width / width,
				available.height / height,
			),
			strata: "DIALOG",
			levelOffset: 1,
		});
	}
	unmount(): void {
		this.parent = undefined;
		if (this.focused) TalentDisplayMixin.OnLeave(this.focused);
		this.focused = undefined;
		PlayerSpellsFrame?.TalentsFrame.HideSelections();
		if (this.heroCollapsed !== undefined)
			PlayerSpellsFrame?.TalentsFrame.HeroTalentsContainer.SetCollapsed(
				this.heroCollapsed,
				true,
			);
		this.heroCollapsed = undefined;
		this.focus.release();
		this.layout.release();
		this.size = undefined;
		if (this.native.isFullOpen()) this.native.close();
	}
	navigation(): NavGrid {
		const tree = PlayerSpellsFrame?.TalentsFrame;
		if (!this.parent || !tree) return [];
		const choice = tree.SelectionChoiceFrame.IsShown();
		const buttons: NativeTalentButton[] = [];
		if (choice) buttons.push(...tree.SelectionChoiceFrame.selectionFrameArray);
		else
			for (const button of tree.EnumerateAllTalentButtons())
				buttons.push(button);
		const positioned: { button: NativeTalentButton; x: number; y: number }[] =
			[];
		for (const button of buttons) {
			if (!button.IsVisible()) continue;
			const [x, y] = button.GetCenter();
			if (x === undefined || y === undefined) continue;
			const scale = button.GetEffectiveScale();
			positioned.push({
				button,
				x: Math.round(x * scale),
				y: Math.round(y * scale),
			});
		}
		positioned.sort((a, b) => b.y - a.y || a.x - b.x);
		const grid: NavGrid = [];
		let rowY: number | undefined;
		for (const { button, x, y } of positioned) {
			if (rowY === undefined || Math.abs(rowY - y) > 4) {
				grid.push([]);
				rowY = y;
			}
			const id = choice
				? `talent-choice-${button.GetEntryID()}`
				: `talent-node-${button.GetNodeID?.()}`;
			const node = this.focus.navigation(button, undefined, id, () =>
				button.OnClick("LeftButton"),
			);
			grid.at(-1)?.push({
				...node,
				navColumn: x,
				onFocus: (refresh) => {
					node.onFocus(refresh);
					if (this.focused) TalentDisplayMixin.OnLeave(this.focused);
					this.focused = button;
					// The base display preserves Blizzard's icon-anchored tooltip without
					// starting the choice node's mouse-only auto-open/auto-close timer.
					TalentDisplayMixin.OnEnter(button);
				},
				onBlur: () => {
					node.onBlur();
					if (this.focused === button) {
						TalentDisplayMixin.OnLeave(button);
						this.focused = undefined;
					}
				},
				onContext:
					!choice && button.talentSelections && button.ShowSelections
						? () => {
								button.ShowSelections?.();
								this.changed();
							}
						: undefined,
			});
		}
		return grid;
	}
	dismissChoices(): boolean {
		const tree = PlayerSpellsFrame?.TalentsFrame;
		if (!this.parent || !tree?.SelectionChoiceFrame.IsShown()) return false;
		tree.HideSelections();
		this.changed();
		return true;
	}
}
