import type { IEventBus } from "../events/types";
import type { AddonsDialogFrame } from "../modules/system-dialogs/wow-addons-globals";
import type {
	NativeDialogFrame,
	NativeDialogNavigation,
} from "../ui/components/native-dialog-navigation";
import type { INavigable, NavGrid } from "../ui/navigation/types";
import type { ITaskScheduler } from "./task-scheduler";

export interface NativeDialog {
	readonly id: string;
	readonly grid: NavGrid;
	cancel(): void;
}
export interface INativeDialogsClient {
	initialize(): void;
	getDialogs(): NativeDialog[];
	shutdown(): void;
}

export class NativeDialogsClient implements INativeDialogsClient {
	private readonly dialogs = new Map<
		NativeDialogFrame,
		{ id: string; menu: boolean; visible: boolean; order: number }
	>();
	private active = false;
	private hooked = false;
	private sequence = 0;
	private cancelPending?: () => void;
	private readonly hookedMenus = new Set<NativeDialogFrame>();
	private readonly hookedAddons = new Set<NativeDialogFrame>();
	constructor(
		private readonly events: IEventBus,
		private readonly controls: Pick<
			NativeDialogNavigation,
			"watch" | "grid" | "release" | "addMenuAction" | "control" | "list"
		>,
		private readonly scheduler: Pick<ITaskScheduler, "nextFrame">,
		private readonly sources: readonly INativeDialogsClient[] = [],
	) {}
	initialize(): void {
		this.active = true;
		for (const source of this.sources) source.initialize();
		this.discover();
		if (!this.hooked) {
			this.hooked = true;
			const hook = hooksecurefunc as unknown as (
				this: void,
				name: string,
				callback: (
					this: void,
					frame: NativeDialogFrame & { GetName(): string | undefined },
				) => void,
			) => void;
			hook("StaticPopupSpecial_Show", (frame) => {
				if (!this.active) return;
				this.watch(frame, frame.GetName() ?? `special-${this.dialogs.size}`);
				this.changed(frame);
			});
			for (const name of [
				"StaticPopup_Show",
				"GameMenuFrame_Show",
				"ShowUIPanel",
			])
				hook(name, () => {
					if (this.active) this.discover();
				});
		}
	}
	private discover(): void {
		const globals = _G as unknown as Record<
			string,
			NativeDialogFrame | undefined
		>;
		for (const name of [
			"GameMenuFrame",
			"AddonList",
			"StaticPopup1",
			"StaticPopup2",
			"StaticPopup3",
			"StaticPopup4",
			"LFGDungeonReadyPopup",
			"LFDRoleCheckPopup",
			"LFGReadyCheckPopup",
			"PVPRoleCheckPopup",
			"ReadyCheckFrame",
			"LFGListApplicationDialog",
			"LFGListInviteDialog",
		]) {
			const frame = globals[name];
			if (frame) this.watch(frame, name);
		}
	}
	private watch(frame: NativeDialogFrame, name: string): void {
		if (name === "GameMenuFrame") this.watchMenu(frame);
		if (name === "AddonList" && !this.hookedAddons.has(frame)) {
			this.hookedAddons.add(frame);
			hooksecurefunc("AddonList_Update", () => this.changed(frame));
		}
		if (this.dialogs.has(frame)) return;
		this.dialogs.set(frame, {
			id: `native-${name}`,
			menu: name === "GameMenuFrame",
			visible: false,
			order: 0,
		});
		this.controls.watch(frame, () => this.changed(frame));
		if (name === "AddonList")
			this.controls.watch((frame as AddonsDialogFrame).Dropdown, () =>
				this.changed(frame),
			);
		this.changed(frame);
	}
	private addonsGrid(id: string, frame: AddonsDialogFrame): NavGrid {
		if (frame.Dropdown.IsMenuOpen() && frame.Dropdown.menu) {
			this.controls.watch(frame.Dropdown.menu, () => this.changed(frame));
			return this.controls.grid(`${id}:characters`, frame.Dropdown.menu, true);
		}
		const row = (
			names: readonly (
				| "Dropdown"
				| "ForceLoad"
				| "SearchBox"
				| "EnableAllButton"
				| "DisableAllButton"
				| "OkayButton"
				| "CancelButton"
			)[],
		) =>
			names.flatMap((name) => {
				const control = frame[name];
				return control.IsVisible() && control.IsEnabled()
					? [this.controls.control(`${id}:${name}`, control)]
					: [];
			});
		const grid = [
			row(["Dropdown", "ForceLoad", "SearchBox"]),
			...this.controls.list(
				id,
				frame.ScrollBox,
				(node) => {
					const data = node.GetData();
					return data.addonIndex !== undefined
						? `addon-${data.addonIndex}`
						: `category-${data.category}`;
				},
				(entry) =>
					(entry as NativeDialogFrame & { LoadAddonButton?: NativeDialogFrame })
						.LoadAddonButton,
			),
			row([
				"EnableAllButton",
				"DisableAllButton",
				"OkayButton",
				"CancelButton",
			]),
		];
		return grid.filter((row) => row.length > 0);
	}
	private watchMenu(frame: NativeDialogFrame): void {
		if (this.hookedMenus.has(frame)) return;
		this.hookedMenus.add(frame);
		let inserted = false;
		const hook = hooksecurefunc as unknown as (
			this: void,
			frame: NativeDialogFrame,
			method: string,
			callback: (this: void, frame: NativeDialogFrame, text?: string) => void,
		) => void;
		hook(frame, "Reset", () => {
			inserted = false;
		});
		hook(frame, "AddButton", (_menu, text) => {
			const globals = _G as unknown as {
				ADDONS: string;
				GAMEMENU_SUPPORT: string;
			};
			if (
				!this.active ||
				inserted ||
				(text !== globals.ADDONS && text !== globals.GAMEMENU_SUPPORT)
			)
				return;
			inserted = true;
			this.controls.addMenuAction(frame, "Reload UI", () => {
				if (this.active) C_UI.Reload();
			});
		});
	}
	private changed(frame: NativeDialogFrame): void {
		if (!this.active) return;
		const dialog = this.dialogs.get(frame);
		if (dialog) {
			const visible = frame.IsVisible();
			if (visible && !dialog.visible) dialog.order = ++this.sequence;
			dialog.visible = visible;
		}
		if (this.cancelPending) return;
		this.cancelPending = this.scheduler.nextFrame(() => {
			this.cancelPending = undefined;
			if (this.active) this.events.emit("NATIVE_DIALOGS_CHANGED");
		});
	}
	getDialogs(): NativeDialog[] {
		const dialogs = [...this.dialogs]
			.filter(([frame]) => frame.IsVisible())
			.sort(([, a], [, b]) => {
				if (a.menu !== b.menu) return a.menu ? -1 : 1;
				return a.order - b.order;
			})
			.map(
				([frame, dialog]): NativeDialog => ({
					id: dialog.id,
					grid: this.dialogGrid(dialog.id, frame, dialog.menu),
					cancel: () => {
						const globals = _G as unknown as {
							GameMenuFrame_EscapePressed(this: void): void;
							StaticPopup_EscapePressed(this: void): void;
							AddonList_OnCancel(this: void): void;
						};
						if (!frame.IsVisible()) return;
						if (dialog.id === "native-AddonList") {
							const addons = frame as AddonsDialogFrame;
							if (addons.Dropdown.IsMenuOpen()) addons.Dropdown.CloseMenu();
							else globals.AddonList_OnCancel();
							this.changed(frame);
						} else if (
							dialog.id === "native-LFGListApplicationDialog" ||
							dialog.id === "native-LFGListInviteDialog"
						) {
							const prompt = frame as NativeDialogFrame & {
								CancelButton?: NativeDialogFrame;
								DeclineButton?: NativeDialogFrame;
								AcknowledgeButton?: NativeDialogFrame;
							};
							const cancel =
								dialog.id === "native-LFGListApplicationDialog"
									? prompt.CancelButton
									: prompt.DeclineButton?.IsVisible()
										? prompt.DeclineButton
										: prompt.AcknowledgeButton;
							if (cancel)
								this.controls
									.control(`${dialog.id}:cancel`, cancel)
									.onInteract();
						} else if (dialog.menu) globals.GameMenuFrame_EscapePressed();
						else if (
							(frame as NativeDialogFrame & { hideOnEscape?: boolean })
								.hideOnEscape
						)
							globals.StaticPopup_EscapePressed();
					},
				}),
			);
		return [
			...this.sources.flatMap((source) => source.getDialogs()),
			...dialogs,
		];
	}
	private dialogGrid(
		id: string,
		frame: NativeDialogFrame,
		menu: boolean,
	): NavGrid {
		const grid =
			id === "native-AddonList"
				? this.addonsGrid(id, frame as AddonsDialogFrame)
				: this.controls.grid(id, frame, menu);
		if (id !== "native-AddonList") return grid;
		return grid.map((row) =>
			row.map(
				(node): INavigable => ({
					...node,
					onInteract: () => {
						node.onInteract();
						this.changed(frame);
					},
					onContext: node.onContext
						? () => {
								node.onContext?.();
								this.changed(frame);
							}
						: undefined,
				}),
			),
		);
	}
	shutdown(): void {
		this.active = false;
		this.cancelPending?.();
		this.cancelPending = undefined;
		this.dialogs.clear();
		for (const source of this.sources) source.shutdown();
		this.controls.release();
	}
}
