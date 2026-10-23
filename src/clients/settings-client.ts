import type { IEventBus } from "../events/types";
import type {
	NativeDialogFrame,
	NativeDialogList,
	NativeDialogMenu,
	NativeDialogNavigation,
} from "../ui/components/native-dialog-navigation";
import type { INavigable, NavGrid } from "../ui/navigation/types";
import type {
	INativeDialogsClient,
	NativeDialog,
} from "./native-dialogs-client";
import type { ITaskScheduler } from "./task-scheduler";

interface Initializer {
	GetTemplate(): string;
	data?: { category?: { GetID(): number } };
}
interface SettingsDropdown extends NativeDialogFrame {
	menu?: NativeDialogMenu;
	IsMenuOpen(): boolean;
	CloseMenu(): void;
}
interface SettingsPanel extends NativeDialogFrame {
	GameTab: NativeDialogFrame;
	AddOnsTab: NativeDialogFrame;
	SearchBox: NativeDialogFrame;
	CloseButton: NativeDialogFrame;
	ApplyButton: NativeDialogFrame;
	CategoryList: { ScrollBox: NativeDialogList<Initializer> };
	Container: {
		SettingsList: NativeDialogFrame & {
			ScrollBox: NativeDialogList<Initializer>;
			Header: { DefaultsButton: NativeDialogFrame };
		};
		SettingsCanvas: NativeDialogFrame;
	};
}

// Retail Blizzard_SettingControls.lua owns these children and their actions.
const controlPaths: Record<string, readonly string[]> = {
	SettingsCheckboxControlTemplate: ["Checkbox"],
	SettingsSliderControlTemplate: ["SliderWithSteppers.Slider"],
	SettingsDropdownControlTemplate: ["Control.Dropdown"],
	SettingButtonControlTemplate: ["Button"],
	SettingsColorSwatchControlTemplate: ["ColorSwatch"],
	SettingsCheckboxWithButtonControlTemplate: ["Checkbox", "Button"],
	SettingsCheckboxSliderControlTemplate: [
		"Checkbox",
		"SliderWithSteppers.Slider",
	],
	SettingsCheckboxDropdownControlTemplate: ["Checkbox", "Control.Dropdown"],
	SettingsCheckboxWithColorSwatchControlTemplate: ["Checkbox", "ColorSwatch"],
	SettingsExpandableSectionTemplate: ["Button"],
	SettingsListSearchCategoryTemplate: [""],
};

export class SettingsClient implements INativeDialogsClient {
	private active = false;
	private cancelPending?: () => void;
	private readonly hooked = new Set<SettingsPanel>();
	private readonly ids = new Map<Initializer, number>();
	private readonly dropdowns = new Set<SettingsDropdown>();
	constructor(
		private readonly events: IEventBus,
		private readonly controls: Pick<
			NativeDialogNavigation,
			"watch" | "list" | "grid" | "control" | "click" | "menu" | "release"
		>,
		private readonly scheduler: Pick<ITaskScheduler, "nextFrame">,
	) {}
	initialize(): void {
		this.active = true;
		this.events.subscribe("DIALOGUE_ADDON_LOADED", this.discover);
		this.discover();
	}
	private host(): SettingsPanel | undefined {
		return (_G as unknown as { SettingsPanel?: SettingsPanel }).SettingsPanel;
	}
	private readonly changed = () => {
		if (!this.active || this.cancelPending) return;
		this.cancelPending = this.scheduler.nextFrame(() => {
			this.cancelPending = undefined;
			if (this.active) this.events.emit("NATIVE_DIALOGS_CHANGED");
		});
	};
	private readonly discover = () => {
		const host = this.host();
		if (!this.active || !host) return;
		this.controls.watch(host, this.changed);
		if (!this.hooked.has(host)) {
			this.hooked.add(host);
			const hook = hooksecurefunc as unknown as (
				this: void,
				frame: SettingsPanel,
				method: string,
				callback: (this: void) => void,
			) => void;
			for (const method of [
				"SelectCategory",
				"DisplayLayout",
				"OnSearchTextChanged",
				"OnSettingValueChanged",
			])
				hook(host, method, () => this.changed());
		}
		this.changed();
	};
	private resolve(
		frame: NativeDialogFrame,
		path: string,
	): NativeDialogFrame | undefined {
		let result: unknown = frame;
		for (const part of path === "" ? [] : path.split("."))
			result = (result as Record<string, unknown> | undefined)?.[part];
		if (path === "Control.Dropdown" && result) {
			const dropdown = result as SettingsDropdown;
			this.dropdowns.add(dropdown);
			this.controls.watch(dropdown, this.changed);
		}
		return result as NativeDialogFrame | undefined;
	}
	private settingsGrid(host: SettingsPanel): NavGrid {
		const list = host.Container.SettingsList;
		if (!list.IsVisible())
			return this.controls
				.grid("settings:canvas", host.Container.SettingsCanvas)
				.map((line) =>
					line.map((node, column) => ({ ...node, navColumn: column + 1 })),
				);
		const scroll = list.ScrollBox;
		const lines: NavGrid = [];
		scroll.ForEachElementData((data) => {
			const paths = controlPaths[data.GetTemplate()] ?? [];
			if (!this.ids.has(data)) this.ids.set(data, this.ids.size + 1);
			const line = paths.flatMap((path, column) => {
				const realized = scroll.FindFrame(data);
				const control = realized && this.resolve(realized, path);
				if (realized && (!control?.IsVisible() || !control.IsEnabled()))
					return [];
				const virtual: NativeDialogList<Initializer> = {
					ForEachElementData: (callback) => callback(data),
					ScrollToElementData: (...args) => scroll.ScrollToElementData(...args),
					FindFrame: (entry) => {
						const row = scroll.FindFrame(entry);
						return row && this.resolve(row, path);
					},
				};
				const node = this.controls
					.list("settings:row", virtual, () => `${this.ids.get(data)}:${path}`)
					.at(0)
					?.at(0);
				return node ? [{ ...node, navColumn: column + 1 }] : [];
			});
			if (line.length > 0) lines.push(line);
		});
		return lines;
	}
	getDialogs(): NativeDialog[] {
		const host = this.host();
		if (!this.active || !host?.IsVisible()) return [];
		const scroll = host.CategoryList.ScrollBox;
		const categories = this.controls.list<Initializer>(
			"settings:category",
			{
				ForEachElementData: (callback) =>
					scroll.ForEachElementData((data) => {
						if (data.data?.category) callback(data);
					}),
				ScrollToElementData: (...args) => scroll.ScrollToElementData(...args),
				FindFrame: (data) => scroll.FindFrame(data),
			},
			(data) => `${data.data?.category?.GetID()}`,
			(frame) => this.resolve(frame, "Toggle"),
		);
		const content = this.settingsGrid(host);
		const dropdown = [...this.dropdowns].find(
			(frame) => frame.IsVisible() && frame.IsMenuOpen(),
		);
		if (dropdown?.menu?.IsVisible()) {
			this.controls.watch(dropdown.menu, this.changed);
			return [
				{
					id: "native-settings",
					grid: this.refreshAfterActions(
						this.controls.menu("settings:dropdown", dropdown.menu),
					),
					cancel: () => {
						if (this.active && dropdown.IsMenuOpen()) dropdown.CloseMenu();
						this.changed();
					},
				},
			];
		}
		const row = (entries: readonly [string, NativeDialogFrame][]) =>
			entries.flatMap(([id, frame]) =>
				frame.IsVisible() && frame.IsEnabled()
					? [this.controls.control(`settings:${id}`, frame)]
					: [],
			);
		const grid: NavGrid = [
			row([
				["game", host.GameTab],
				["addons", host.AddOnsTab],
				["search", host.SearchBox],
			]),
		];
		for (
			let index = 0;
			index < Math.max(categories.length, content.length);
			index++
		)
			grid.push([
				...(categories.at(index) ?? []).map((node) => ({
					...node,
					navColumn: 0,
				})),
				...(content.at(index) ?? []),
			]);
		grid.push(
			row([
				["defaults", host.Container.SettingsList.Header.DefaultsButton],
				["apply", host.ApplyButton],
				["close", host.CloseButton],
			]),
		);
		return [
			{
				id: "native-settings",
				grid: this.refreshAfterActions(grid),
				cancel: () => {
					if (this.active && host.IsVisible())
						this.controls.click(host.CloseButton);
				},
			},
		];
	}
	private refreshAfterActions(grid: NavGrid): NavGrid {
		return grid.map((line) =>
			line.map(
				(node): INavigable => ({
					...node,
					onInteract: () => {
						node.onInteract();
						this.changed();
					},
					onContext: () => {
						node.onContext?.();
						this.changed();
					},
				}),
			),
		);
	}
	shutdown(): void {
		this.active = false;
		this.events.unsubscribe("DIALOGUE_ADDON_LOADED", this.discover);
		this.cancelPending?.();
		this.cancelPending = undefined;
		this.ids.clear();
		this.dropdowns.clear();
		this.controls.release();
	}
}
