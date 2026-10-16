import type { IEventBus } from "../events/types";
import type {
	NativeTalentButton,
	NativeTalentControl,
	NativeTalentMenu,
} from "../modules/talents/wow-talents-globals";
import type { Frame } from "../ui/components/frame";
import type { NativeLayout } from "../ui/components/native-layout";
import type { NativeNavigation } from "../ui/components/native-navigation";
import type { NativeVisibility } from "../ui/components/native-visibility";
import type { NavGrid } from "../ui/navigation/types";

export interface ITalentTreeClient {
	presentation(available: { width: number; height: number }): {
		width: number;
		height: number;
	};
	mount(parent: Frame): void;
	resize(): void;
	unmount(): void;
	navigation(): NavGrid;
	dismissChoices(): boolean;
}

export class TalentTreeClient implements ITalentTreeClient {
	private parent?: Frame;
	private hooked = false;
	private leaveFocused?: () => void;
	private size?: readonly [number, number];
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
		private readonly chrome: Pick<NativeVisibility, "hide" | "restore">,
	) {}
	mount(parent: Frame): void {
		this.native.openFull();
		const frame = PlayerSpellsFrame;
		if (!frame) return;
		this.parent = parent;
		const [width, height] = frame.TalentsFrame.GetSize();
		this.size = [width, height];
		const tree = frame.TalentsFrame;
		this.heroCollapsed = tree.HeroTalentsContainer.isCollapsed;
		if (!this.hooked) {
			// Hook the rebuild method, rather than adding an always-running OnUpdate script.
			hooksecurefunc(tree, "OnUpdate", () => this.changed());
			// Blizzard may already have stored the unhooked OnUpdate script.
			// These methods are resolved when that script builds/positions nodes.
			hooksecurefunc(tree, "LoadTalentTreeInternal", () => this.changed());
			hooksecurefunc(tree, "UpdateAllTalentButtonPositions", () =>
				this.changed(),
			);
			tree.SelectionChoiceFrame.HookScript("OnShow", this.changed);
			tree.SelectionChoiceFrame.HookScript("OnHide", this.changed);
			tree.heroSpecSelectionDialog.HookScript("OnShow", this.changed);
			tree.heroSpecSelectionDialog.HookScript("OnHide", this.changed);
			this.hooked = true;
		}
		// Keep every hero node visible without changing the player's saved collapse preference.
		tree.HeroTalentsContainer.SetCollapsed(false, true);
		this.resize();
		this.chrome.hide(
			[
				frame.NineSlice,
				frame.PortraitContainer,
				frame.TitleContainer,
				frame.CloseButton,
				frame.MaximizeMinimizeButton,
				frame.TabSystem,
				frame.Bg,
				frame.TopTileStreaks,
			].filter((region) => region !== undefined),
		);
	}
	presentation(available: { width: number; height: number }): {
		width: number;
		height: number;
	} {
		let size = this.size;
		if (!size && PlayerSpellsFrame) {
			const [width, height] = PlayerSpellsFrame.TalentsFrame.GetSize();
			size = [width, height];
		}
		if (!size) return available;
		const [width, height] = size;
		const scale = Math.min(
			1,
			available.width / width,
			available.height / height,
		);
		return { width: width * scale, height: height * scale };
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
			scale: Math.min(1, available.width / width, available.height / height),
			strata: "DIALOG",
			levelOffset: 1,
		});
		// Preserve the native script owner: talent actions resolve PlayerSpellsFrame via GetParent().
		this.layout.bind(frame.TalentsFrame, {
			parent: frame,
			reparent: false,
			anchors: [["CENTER", "CENTER", 0, 0]],
			size: [width, height],
			scale: 1,
		});
	}
	unmount(): void {
		this.parent = undefined;
		this.leaveFocused?.();
		this.leaveFocused = undefined;
		if (PlayerSpellsFrame?.TalentsFrame.heroSpecSelectionDialog.IsShown())
			PlayerSpellsFrame.TalentsFrame.heroSpecSelectionDialog.Hide();
		PlayerSpellsFrame?.TalentsFrame.HideSelections();
		PlayerSpellsFrame?.TalentsFrame.ResetButton?.CloseMenu?.();
		if (this.heroCollapsed !== undefined)
			PlayerSpellsFrame?.TalentsFrame.HeroTalentsContainer.SetCollapsed(
				this.heroCollapsed,
				true,
			);
		this.heroCollapsed = undefined;
		this.focus.release();
		this.layout.release();
		this.chrome.restore();
		this.size = undefined;
		if (this.native.isFullOpen()) this.native.close();
	}
	navigation(): NavGrid {
		const tree = PlayerSpellsFrame?.TalentsFrame;
		if (!this.parent || !tree) return [];
		const choice = tree.SelectionChoiceFrame.IsShown();
		const dialog = tree.heroSpecSelectionDialog;
		const heroChoice = dialog.IsShown();
		const controls: { button: NativeTalentControl; id: string }[] = [];
		const reset = tree.ResetButton;
		const resetMenu = reset?.IsMenuOpen?.() ? reset.menu : undefined;
		const collectMenu = (menu: NativeTalentMenu): void => {
			for (const button of [...menu.GetChildren()]) {
				if (button.IsObjectType("Button") && button.IsVisible())
					controls.push({
						button,
						id: `talent-reset-option-${controls.length}`,
					});
				if (button.GetChildren) collectMenu(button as NativeTalentMenu);
			}
		};
		const heroParents = [];
		if (resetMenu) collectMenu(resetMenu);
		else if (!choice) {
			if (heroChoice) {
				for (const spec of dialog.SpecContentFramePool.EnumerateActive()) {
					heroParents.push(spec.NodesContainer);
					controls.push(
						{
							button: spec.ActivateButton,
							id: `talent-hero-activate-${spec.subTreeID}`,
						},
						{
							button: spec.ApplyChangesButton,
							id: `talent-hero-apply-${spec.subTreeID}`,
						},
					);
				}
			} else {
				if (reset) controls.push({ button: reset, id: "talent-reset" });
				if (tree.UndoButton)
					controls.push({ button: tree.UndoButton, id: "talent-undo" });
				controls.push(
					{ button: tree.ApplyButton, id: "talent-apply" },
					{
						button: tree.HeroTalentsContainer.HeroSpecButton,
						id: "talent-hero-select",
					},
				);
			}
		}
		const buttons: NativeTalentButton[] = [];
		if (!resetMenu && choice)
			buttons.push(...tree.SelectionChoiceFrame.selectionFrameArray);
		else if (!resetMenu)
			for (const button of tree.EnumerateAllTalentButtons())
				if (!heroChoice || heroParents.includes(button.GetParent()))
					buttons.push(button);
		const targets = [
			...buttons.map((button) => ({
				button,
				talent: button,
				id: choice
					? `talent-choice-${button.GetEntryID()}`
					: `talent-node-${button.GetNodeID?.()}`,
			})),
			...controls.map((control) => ({ ...control, talent: undefined })),
		];
		const positioned: {
			target: (typeof targets)[number];
			x: number;
			y: number;
		}[] = [];
		for (const target of targets) {
			const { button } = target;
			if (!button.IsVisible()) continue;
			const [x, y] = button.GetCenter();
			if (x === undefined || y === undefined) continue;
			const scale = button.GetEffectiveScale();
			positioned.push({
				target,
				x: Math.round(x * scale),
				y: Math.round(y * scale),
			});
		}
		positioned.sort((a, b) => b.y - a.y || a.x - b.x);
		const grid: NavGrid = [];
		let rowY: number | undefined;
		for (const {
			target: { button, talent, id },
			x,
			y,
		} of positioned) {
			if (rowY === undefined || Math.abs(rowY - y) > 4) {
				grid.push([]);
				rowY = y;
			}
			const control = talent ? undefined : (button as NativeTalentControl);
			const leave = () => {
				if (talent) TalentDisplayMixin.OnLeave(talent);
				else control?.GetScript("OnLeave")?.(control);
			};
			const node = this.focus.navigation(button, undefined, id, () => {
				if (!choice && talent?.talentSelections && talent.ShowSelections)
					talent.ShowSelections();
				else if (talent) talent.OnClick("LeftButton");
				else if (control?.IsEnabled()) {
					if (control.OpenMenu) control.OpenMenu();
					else control.Click("LeftButton");
				}
				this.changed();
			});
			grid.at(-1)?.push({
				...node,
				navColumn: x,
				onContext:
					!choice && talent
						? () => {
								talent.OnClick("RightButton");
								this.changed();
							}
						: undefined,
				onFocus: (refresh) => {
					node.onFocus(refresh);
					this.leaveFocused?.();
					this.leaveFocused = leave;
					// The base display preserves Blizzard's icon-anchored tooltip without
					// starting the choice node's mouse-only auto-open/auto-close timer.
					if (talent) TalentDisplayMixin.OnEnter(talent);
					else control?.GetScript("OnEnter")?.(control);
				},
				onBlur: () => {
					node.onBlur();
					if (this.leaveFocused === leave) {
						leave();
						this.leaveFocused = undefined;
					}
				},
			});
		}
		return grid;
	}
	dismissChoices(): boolean {
		const tree = PlayerSpellsFrame?.TalentsFrame;
		if (!this.parent || !tree) return false;
		if (tree.ResetButton?.IsMenuOpen?.()) tree.ResetButton.CloseMenu?.();
		else if (tree.SelectionChoiceFrame.IsShown()) tree.HideSelections();
		else if (tree.heroSpecSelectionDialog.IsShown())
			tree.heroSpecSelectionDialog.Hide();
		else return false;
		this.changed();
		return true;
	}
}
