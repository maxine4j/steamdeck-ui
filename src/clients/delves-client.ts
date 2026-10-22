import type { IEventBus } from "../events/types";
import type {
	NativeDialogFrame,
	NativeDialogList,
	NativeDialogMenu,
	NativeDialogNavigation,
} from "../ui/components/native-dialog-navigation";
import type { NativeNavigation } from "../ui/components/native-navigation";
import type { NavGrid } from "../ui/navigation/types";
import type {
	INativeDialogsClient,
	NativeDialog,
} from "./native-dialogs-client";
import type { ITaskScheduler } from "./task-scheduler";

interface MenuDescription {
	AddMenuAcquiredCallback(
		callback: (this: void, menu: NativeDialogMenu) => void,
	): void;
	AddMenuReleasedCallback(
		callback: (this: void, menu: NativeDialogMenu) => void,
	): void;
}
interface DelveDropdown extends NativeDialogFrame {
	GetMenuDescription(): MenuDescription | undefined;
}
interface DelveHost extends NativeDialogFrame {
	CloseButton: NativeDialogFrame;
}
interface DifficultyFrame extends DelveHost {
	Dropdown: DelveDropdown;
}
const slotNames = [
	"CompanionCombatRoleSlot",
	"CompanionFlavorSlot",
	"CompanionCombatTrinketSlot",
	"CompanionUtilityTrinketSlot",
] as const;
interface CompanionSlot extends NativeDialogFrame {
	OptionsList: NativeDialogFrame & {
		ScrollBox: NativeDialogFrame & NativeDialogList<{ entryID: number }>;
	};
}
interface CompanionFrame extends DelveHost {
	CompanionSlots: Partial<Record<(typeof slotNames)[number], CompanionSlot>>;
	CompanionConfigShowAbilitiesButton: NativeDialogFrame;
}
interface AbilityFrame extends DelveHost {
	DelvesCompanionRoleDropdown: DelveDropdown;
	buttons: (NativeDialogFrame & {
		nodeID: number;
		index: number;
		OnEnter(): void;
		OnLeave(): void;
	})[];
}
interface DelveGlobals {
	DelvesDifficultyPickerFrame?: DifficultyFrame;
	DelvesCompanionConfigurationFrame?: CompanionFrame;
	DelvesCompanionAbilityListFrame?: AbilityFrame;
}

/** Controller access to Retail's tier picker and companion configuration. */
export class DelvesClient implements INativeDialogsClient {
	private active = false;
	private cancelPending?: () => void;
	private readonly hooked = new Set<NativeDialogFrame>();
	private readonly descriptions = new Map<DelveDropdown, MenuDescription>();
	private readonly menus = new Map<DelveDropdown, NativeDialogMenu[]>();
	constructor(
		private readonly events: IEventBus,
		private readonly navigation: Pick<NativeNavigation, "navigation">,
		private readonly controls: Pick<
			NativeDialogNavigation,
			| "watch"
			| "grid"
			| "control"
			| "list"
			| "menu"
			| "press"
			| "hide"
			| "click"
			| "release"
		>,
		private readonly scheduler: Pick<ITaskScheduler, "nextFrame">,
	) {}
	initialize(): void {
		this.active = true;
		this.events.subscribe("DIALOGUE_ADDON_LOADED", this.discover);
		this.discover();
	}
	private readonly changed = () => {
		if (!this.active || this.cancelPending) return;
		this.cancelPending = this.scheduler.nextFrame(() => {
			this.cancelPending = undefined;
			if (this.active) this.events.emit("NATIVE_DIALOGS_CHANGED");
		});
	};
	private watch(
		frame: NativeDialogFrame,
		methods: readonly string[] = [],
	): void {
		this.controls.watch(frame, this.changed);
		if (this.hooked.has(frame)) return;
		this.hooked.add(frame);
		const hook = hooksecurefunc as unknown as (
			this: void,
			frame: NativeDialogFrame,
			method: string,
			changed: (this: void) => void,
		) => void;
		for (const method of methods) hook(frame, method, () => this.changed());
	}
	private readonly discover = () => {
		if (!this.active) return;
		const globals = _G as unknown as DelveGlobals;
		const difficulty = globals.DelvesDifficultyPickerFrame;
		if (difficulty) {
			this.watch(difficulty, [
				"UpdatePortalButtonState",
				"SelectedTierInfoChanged",
				"UpdateDropdownState",
			]);
			this.watchDropdown(difficulty.Dropdown);
		}
		const config = globals.DelvesCompanionConfigurationFrame;
		if (config) {
			this.watch(config, ["Refresh"]);
			for (const name of slotNames) {
				const slot = config.CompanionSlots[name];
				if (!slot) continue;
				this.watch(slot);
				this.watch(slot.OptionsList);
				this.watch(slot.OptionsList.ScrollBox, ["SetDataProvider"]);
			}
		}
		const abilities = globals.DelvesCompanionAbilityListFrame;
		if (abilities) {
			this.watch(abilities, ["Refresh", "UpdatePaginatedButtonDisplay"]);
			this.watchDropdown(abilities.DelvesCompanionRoleDropdown);
		}
		this.changed();
	};
	private watchDropdown(dropdown: DelveDropdown): void {
		this.controls.watch(dropdown, this.changed);
		const attach = () => {
			if (!this.active) return;
			const description = dropdown.GetMenuDescription();
			if (!description || description === this.descriptions.get(dropdown))
				return;
			this.descriptions.set(dropdown, description);
			description.AddMenuAcquiredCallback((menu) => {
				if (!this.active) return;
				const menus = this.menus.get(dropdown) ?? [];
				this.menus.set(dropdown, [
					...menus.filter((entry) => entry !== menu),
					menu,
				]);
				this.controls.watch(menu, this.changed);
				this.changed();
			});
			description.AddMenuReleasedCallback((menu) => {
				this.menus.set(
					dropdown,
					(this.menus.get(dropdown) ?? []).filter((entry) => entry !== menu),
				);
				this.changed();
			});
		};
		if (!this.hooked.has(dropdown)) {
			this.hooked.add(dropdown);
			const hook = hooksecurefunc as unknown as (
				this: void,
				frame: DelveDropdown,
				method: string,
				callback: (this: void) => void,
			) => void;
			hook(dropdown, "GenerateMenu", attach);
		}
		attach();
	}
	private openMenus(dropdown?: DelveDropdown): NativeDialogMenu[] {
		return dropdown
			? (this.menus.get(dropdown) ?? []).filter((menu) => menu.IsVisible())
			: [];
	}
	private companionGrid(config: CompanionFrame): NavGrid {
		for (const name of slotNames) {
			const slot = config.CompanionSlots[name];
			if (slot?.OptionsList.IsVisible())
				return this.controls.list(
					`delve:option:${name}`,
					slot.OptionsList.ScrollBox,
					(entry) => `${entry.entryID}`,
				);
		}
		const grid: NavGrid = [];
		for (const name of slotNames) {
			const slot = config.CompanionSlots[name];
			if (!slot?.IsVisible() || !slot.IsEnabled()) continue;
			const node = this.controls.control(`delve:slot:${name}`, slot);
			grid.push([
				{
					...node,
					onInteract: () => {
						this.controls.press(slot);
						this.changed();
					},
				},
			]);
		}
		for (const [id, frame] of [
			["abilities", config.CompanionConfigShowAbilitiesButton],
			["close", config.CloseButton],
		] as const)
			if (frame.IsVisible() && frame.IsEnabled())
				grid.push([this.controls.control(`delve:${id}`, frame)]);
		return grid;
	}
	private abilityGrid(abilities: AbilityFrame): NavGrid {
		const grid = this.controls.grid("delve:abilities", abilities);
		const buttons = [...abilities.buttons]
			.filter((button) => button.IsVisible())
			.sort((a, b) => a.index - b.index);
		for (let index = 0; index < buttons.length; index += 2) {
			const row = buttons.slice(index, index + 2).map((button) =>
				this.navigation.navigation(
					button,
					undefined,
					`delve:ability:${button.nodeID}`,
					() => {},
					{
						enter: () => {
							if (this.active && button.IsVisible()) button.OnEnter();
						},
						leave: () => button.OnLeave(),
					},
				),
			);
			grid.push(row);
		}
		return grid;
	}
	getDialogs(): NativeDialog[] {
		if (!this.active) return [];
		const globals = _G as unknown as DelveGlobals;
		const dialogs: NativeDialog[] = [];
		const add = (
			id: string,
			host: DelveHost | undefined,
			grid: () => NavGrid,
			dropdown?: DelveDropdown,
			config?: CompanionFrame,
		) => {
			if (!host?.IsVisible()) return;
			const menu = this.openMenus(dropdown).at(-1);
			dialogs.push({
				id,
				grid: menu ? this.controls.menu(`${id}:menu`, menu) : grid(),
				cancel: () => {
					if (!this.active || !host.IsVisible()) return;
					const menus = this.openMenus(dropdown);
					if (menus.length > 1) menus.at(-1)?.Close?.();
					else if (menus.length > 0) dropdown?.CloseMenu?.();
					else {
						const options =
							config &&
							slotNames
								.map((name) => config.CompanionSlots[name]?.OptionsList)
								.find((list) => list?.IsVisible());
						if (options) this.controls.hide(options);
						else this.controls.click(host.CloseButton);
					}
					this.changed();
				},
			});
		};
		const difficulty = globals.DelvesDifficultyPickerFrame;
		add(
			"native-delve-difficulty",
			difficulty,
			() =>
				this.controls.grid("delve:difficulty", difficulty as DifficultyFrame),
			difficulty?.Dropdown,
		);
		const config = globals.DelvesCompanionConfigurationFrame;
		add(
			"native-delve-companion",
			config,
			() => this.companionGrid(config as CompanionFrame),
			undefined,
			config,
		);
		const abilities = globals.DelvesCompanionAbilityListFrame;
		add(
			"native-delve-abilities",
			abilities,
			() => this.abilityGrid(abilities as AbilityFrame),
			abilities?.DelvesCompanionRoleDropdown,
		);
		return dialogs;
	}
	shutdown(): void {
		this.active = false;
		this.events.unsubscribe("DIALOGUE_ADDON_LOADED", this.discover);
		this.cancelPending?.();
		this.cancelPending = undefined;
		this.controls.release();
	}
}
