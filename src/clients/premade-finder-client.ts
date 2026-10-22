import type { IEventBus } from "../events/types";
import type {
	PremadeControl,
	PremadeCreation,
} from "../modules/dungeon-finder/wow-premade-finder-globals";
import type { Frame } from "../ui/components/frame";
import type {
	NativeDialogFrame,
	NativeDialogMenu,
	NativeDialogNavigation,
} from "../ui/components/native-dialog-navigation";
import type { NativeLayout } from "../ui/components/native-layout";
import type { NavGrid } from "../ui/navigation/types";

export interface IPremadeFinderClient {
	mount(parent: Frame, pvp: boolean): void;
	resize(): void;
	navigation(): NavGrid;
	back(): boolean;
	unmount(): void;
}

/** Retains Retail's protected search/name widgets and native listing lifecycle. */
export class PremadeFinderClient implements IPremadeFinderClient {
	private parent?: Frame;
	private hooked = false;
	private readonly hookedDropdowns = new Set<PremadeControl>();
	private readonly menus = new Set<NativeDialogMenu>();
	private titleSelection?: readonly [
		number,
		number,
		number | undefined,
		number | undefined,
	];
	constructor(
		private readonly events: IEventBus,
		private readonly layout: Pick<NativeLayout, "bind" | "release">,
		private readonly controls: Pick<
			NativeDialogNavigation,
			"watch" | "grid" | "menu" | "list" | "control" | "release"
		>,
	) {}
	private readonly changed = () => {
		if (this.parent) this.events.emit("DUNGEON_FINDER_CHANGED");
	};
	mount(parent: Frame, pvp: boolean): void {
		(C_AddOns.LoadAddOn as unknown as (this: void, name: string) => void)(
			"Blizzard_GroupFinder",
		);
		this.parent = parent;
		if (!this.hooked) {
			this.hooked = true;
			const hook = hooksecurefunc as unknown as (
				this: void,
				name: string,
				callback: (this: void, creation: PremadeCreation) => void,
			) => void;
			hook("LFGListEntryCreation_SetTitleFromActivityInfo", (creation) =>
				this.prefillTitle(creation),
			);
			hook("LFGListCategorySelection_StartFindGroup", () => {
				if (this.parent)
					LFGListFrame.SearchPanel.shouldAlwaysShowCreateGroupButton = true;
			});
		}
		const filters = (
			_G as unknown as { Enum: { LFGListFilter: { PvE: number; PvP: number } } }
		).Enum.LFGListFilter;
		LFGListFrame_SetBaseFilters(LFGListFrame, pvp ? filters.PvP : filters.PvE);
		LFGListFrame_FixPanelValid(LFGListFrame);
		LFGListFrame.SearchPanel.shouldAlwaysShowCreateGroupButton = true;
		this.controls.watch(LFGListFrame, this.changed);
		for (const dropdown of this.dropdowns()) this.watchDropdown(dropdown);
		this.resize();
	}
	private watchDropdown(dropdown?: PremadeControl): void {
		if (!dropdown?.GetMenuDescription || this.hookedDropdowns.has(dropdown))
			return;
		this.hookedDropdowns.add(dropdown);
		const hook = hooksecurefunc as unknown as (
			this: void,
			frame: PremadeControl,
			method: string,
			callback: (this: void) => void,
		) => void;
		// GenerateMenu runs before OpenMenu acquires the root. Shared callbacks
		// report every detached submenu too (Blizzard_Menu/Menu.lua).
		hook(dropdown, "GenerateMenu", () => {
			if (!this.parent) return;
			const description = dropdown.GetMenuDescription?.();
			description?.AddMenuAcquiredCallback((menu) => {
				if (!this.parent) return;
				this.menus.add(menu);
				this.controls.watch(menu, this.changed);
				this.changed();
			});
			description?.AddMenuReleasedCallback((menu) => {
				this.menus.delete(menu);
				this.changed();
			});
		});
	}
	resize(): void {
		if (!this.parent) return;
		const { width, height } = this.parent.getSize();
		const scale = Math.max(
			0.1,
			Math.min((width - 32) / 338, (height - 80) / 428, 1.25),
		);
		// LFGListFrame contains only feature content; PVEFrame's outer chrome stays
		// suppressed. Reparenting the content avoids its hidden native ancestors.
		this.layout.bind(LFGListFrame, {
			parent: this.parent,
			reparent: true,
			visible: true,
			size: [338, 428],
			scale,
			alpha: 1,
			anchors: [["TOP", "TOP", 0, -64 / scale]],
		});
	}
	private prefillTitle(creation: PremadeCreation): void {
		if (!this.parent || creation.editMode) return;
		const activity = creation.selectedActivity;
		const group = creation.selectedGroup;
		if (activity === undefined || group === undefined) return;
		const previous = this.titleSelection;
		const automatic =
			creation.Name.GetText() === "" ||
			(previous !== undefined &&
				C_LFGList.DoesEntryTitleMatchPrebuiltTitle(...previous));
		this.titleSelection = [
			activity,
			group,
			creation.selectedPlaystyle,
			creation.generalPlaystyle,
		];
		// securityDisableSetText=true prohibits Name:SetText. This supported API
		// constructs a title from activity/playstyle and preserves user edits.
		if (automatic) C_LFGList.SetEntryTitle(...this.titleSelection);
	}
	private dropdowns(): (PremadeControl | undefined)[] {
		const creation = LFGListFrame.EntryCreation;
		return [
			LFGListFrame.SearchPanel.FilterButton,
			creation.GroupDropdown,
			creation.ActivityDropdown,
			creation.PlayStyleDropdown,
		];
	}
	private openMenu(): PremadeControl | undefined {
		return this.dropdowns().find((control) => control?.IsMenuOpen?.());
	}
	private row(id: string, frame?: PremadeControl): NavGrid {
		return frame?.IsVisible() && frame.IsEnabled()
			? [[this.controls.control(id, frame)]]
			: [];
	}
	navigation(): NavGrid {
		if (!this.parent) return [];
		const dropdown = this.openMenu();
		const menu =
			[...this.menus].filter((entry) => entry.IsVisible()).at(-1) ??
			dropdown?.menu;
		if (menu) {
			this.controls.watch(menu, this.changed);
			return this.controls.menu("premade-menu", menu);
		}
		const root = LFGListFrame;
		const activityFinder = root.EntryCreation.ActivityFinder;
		if (
			root.activePanel === root.EntryCreation &&
			activityFinder?.IsVisible()
		) {
			const dialog = activityFinder.Dialog;
			return [
				...this.row("premade-activity-search", dialog.EntryBox),
				...this.controls.list(
					"premade-activity",
					dialog.ScrollBox,
					(data) => `${data.id}`,
				),
				...this.row("premade-activity-select", dialog.SelectButton),
				...this.row("premade-activity-cancel", dialog.CancelButton),
			];
		}
		if (root.activePanel === root.ApplicationViewer) {
			const viewer = root.ApplicationViewer;
			return [
				...this.row("premade-applicants-refresh", viewer.RefreshButton),
				...this.row("premade-auto-accept", viewer.AutoAcceptButton),
				...this.controls.list(
					"premade-applicant",
					viewer.ScrollBox,
					(data) => `${data.id}`,
					(frame) =>
						(frame as NativeDialogFrame & { DeclineButton?: NativeDialogFrame })
							.DeclineButton,
					(frame) => {
						const row = frame as NativeDialogFrame & {
							InviteButton?: NativeDialogFrame;
							InviteButtonSmall?: NativeDialogFrame;
						};
						return row.InviteButton?.IsVisible()
							? row.InviteButton
							: row.InviteButtonSmall;
					},
				),
				...this.row("premade-delist", viewer.RemoveEntryButton),
				...this.row("premade-edit", viewer.EditButton),
				...this.row("premade-browse", viewer.BrowseGroupsButton),
			];
		}
		if (root.activePanel === root.SearchPanel) {
			const search = root.SearchPanel;
			return [
				...this.row("premade-search", search.SearchBox),
				...this.row("premade-filters", search.FilterButton),
				...this.row("premade-refresh", search.RefreshButton),
				...this.controls.list(
					"premade-result",
					search.ScrollBox,
					(data) => (data.startGroup ? "create" : `${data.resultID}`),
					(frame) =>
						(frame as NativeDialogFrame & { CancelButton?: NativeDialogFrame })
							.CancelButton,
				),
				...this.row("premade-create", search.ScrollBox.StartGroupButton),
				...this.row("premade-back", search.BackButton),
				...this.row("premade-back-to-group", search.BackToGroupButton),
				...this.row("premade-signup", search.SignUpButton),
			];
		}
		return this.controls.grid("premade", root.activePanel ?? root);
	}
	back(): boolean {
		if (!this.parent) return false;
		const menus = [...this.menus].filter((entry) => entry.IsVisible());
		if (menus.length > 1) {
			menus.at(-1)?.Close?.();
			return true;
		}
		const menu = this.openMenu();
		if (menu) {
			menu.CloseMenu?.();
			return true;
		}
		const root = LFGListFrame;
		const picker = root.EntryCreation.ActivityFinder;
		if (root.activePanel === root.EntryCreation && picker?.IsVisible()) {
			this.controls
				.control("premade-activity-cancel", picker.Dialog.CancelButton)
				.onInteract();
			return true;
		}
		if (root.activePanel === root.SearchPanel) {
			this.controls
				.control("premade-back", root.SearchPanel.BackButton)
				.onInteract();
			return true;
		}
		if (
			root.activePanel === root.EntryCreation &&
			root.EntryCreation.CancelButton?.IsVisible()
		) {
			this.controls
				.control("premade-creation-back", root.EntryCreation.CancelButton)
				.onInteract();
			return true;
		}
		return false;
	}
	unmount(): void {
		if (!this.parent) return;
		this.openMenu()?.CloseMenu?.();
		this.parent = undefined;
		this.menus.clear();
		this.titleSelection = undefined;
		this.controls.release();
		this.layout.release();
	}
}
