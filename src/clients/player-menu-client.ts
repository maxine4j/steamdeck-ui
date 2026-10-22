import type { IEventBus } from "../events/types";
import type {
	NativeDialogFrame,
	NativeDialogNavigation,
} from "../ui/components/native-dialog-navigation";
import type { NativeMenuHost } from "../ui/components/native-menu-host";
import type { NavGrid } from "../ui/navigation/types";
import type {
	INativeDialogsClient,
	NativeDialog,
} from "./native-dialogs-client";

interface PlayerMenuFrame extends NativeDialogFrame {
	Close(): void;
}
interface PlayerMenuDescription {
	AddMenuAcquiredCallback(
		callback: (this: void, menu: PlayerMenuFrame) => void,
	): void;
	AddMenuReleasedCallback(
		callback: (this: void, menu: PlayerMenuFrame) => void,
	): void;
	CreateButton(
		label: string,
		callback: (this: void) => void,
	): {
		AddInitializer(
			callback: (this: void, frame: NativeDialogFrame) => void,
		): void;
	};
}
interface PlayerMenuGlobals {
	GameMenuFrame?: NativeDialogFrame;
	UnitPopup_OpenMenu(
		this: void,
		which: string,
		context: {
			unit: string;
			menuElementPreInitializer(
				this: void,
				frame: NativeDialogFrame,
				description: unknown,
			): void;
		},
	): void;
	CanExitVehicle(this: void): boolean;
	VehicleExit(this: void): void;
	VEHICLE_LEAVE: string;
	SET_FOCUS: string;
	MenuUtil: { GetElementText(this: void, description: unknown): string };
	Menu: {
		ModifyMenu(
			this: void,
			tag: string,
			callback: (
				this: void,
				owner: unknown,
				root: PlayerMenuDescription,
			) => void,
		): void;
	};
}

/** Blizzard remains responsible for visibility, permissions, confirmations and submenus. */
export class PlayerMenuClient implements INativeDialogsClient {
	private active = false;
	private opening = false;
	private hooked = false;
	private menus: PlayerMenuFrame[] = [];
	private readonly protectedEntries = new Map<NativeDialogFrame, string>();
	private readonly refresh = () => this.events.emit("NATIVE_DIALOGS_CHANGED");
	private readonly prepare = () => {
		if (!this.active) {
			if (this.host.destroy())
				this.events.unsubscribe("COMBAT_ENDED", this.prepare);
			return;
		}
		if (!(_G as unknown as PlayerMenuGlobals).GameMenuFrame?.IsVisible())
			return;
		this.host.prepareAction("player-focus", "focus", "player", () =>
			this.close(),
		);
		this.host.prepareAction("player-vehicle", "leavevehicle", undefined, () =>
			this.close(),
		);
		for (const [frame, id] of this.protectedEntries)
			this.controls.bindSecureAction(frame, this.host.getAction(id));
		if (this.menus.length > 0) this.refresh();
	};
	constructor(
		private readonly events: IEventBus,
		private readonly controls: Pick<
			NativeDialogNavigation,
			"watch" | "grid" | "release" | "bindSecureAction" | "clearSecureAction"
		>,
		private readonly host: Pick<
			NativeMenuHost,
			"place" | "release" | "prepareAction" | "getAction" | "destroy"
		>,
	) {}
	initialize(): void {
		this.active = true;
		this.events.subscribe("COMBAT_ENDED", this.prepare);
		const globals = _G as unknown as PlayerMenuGlobals;
		if (!this.hooked) {
			this.hooked = true;
			globals.Menu.ModifyMenu("MENU_UNIT_SELF", (_owner, root) => {
				if (!this.active || !this.opening) return;
				root.AddMenuAcquiredCallback((menu) => {
					if (!this.active) return;
					this.menus.push(menu);
					this.controls.watch(menu, this.refresh);
					this.refresh();
				});
				root.AddMenuReleasedCallback((menu) => {
					const rootReleased = this.menus.at(0) === menu;
					this.menus = this.menus.filter((entry) => entry !== menu);
					if (rootReleased) {
						this.host.release();
						this.clearProtectedEntries();
					}
					if (this.active) this.refresh();
				});
				if (globals.CanExitVehicle())
					root
						.CreateButton(globals.VEHICLE_LEAVE, () => {
							if (this.active && globals.CanExitVehicle())
								globals.VehicleExit();
						})
						.AddInitializer((frame) =>
							this.bindProtectedEntry(frame, "player-vehicle"),
						);
			});
		}
		if (globals.GameMenuFrame)
			this.controls.watch(globals.GameMenuFrame, () =>
				this.visibilityChanged(),
			);
		this.visibilityChanged();
	}
	private visibilityChanged(): void {
		if (!this.active) return;
		const globals = _G as unknown as PlayerMenuGlobals;
		const game = globals.GameMenuFrame;
		if (!game?.IsVisible()) {
			this.close();
			return;
		}
		if (this.menus.length > 0) return;
		this.prepare();
		this.opening = true;
		globals.UnitPopup_OpenMenu("SELF", {
			unit: "player",
			menuElementPreInitializer: (frame, description) => {
				this.controls.clearSecureAction(frame);
				this.protectedEntries.delete(frame);
				const text = globals.MenuUtil.GetElementText(description);
				if (text === globals.SET_FOCUS || text === globals.VEHICLE_LEAVE)
					this.bindProtectedEntry(
						frame,
						text === globals.SET_FOCUS ? "player-focus" : "player-vehicle",
					);
			},
		});
		this.opening = false;
		const root = this.menus.at(0);
		if (root) this.host.place(root, game);
		this.refresh();
	}
	decorateGameMenu(game: NavGrid): NavGrid {
		if (!this.active) return game;
		const columns = this.menus
			.filter((menu) => menu.IsVisible())
			.map((menu, index) =>
				this.controls.grid(`player-menu:${index}`, menu, true),
			);
		if (columns.length === 0) return game;
		columns.push(game);
		const result: NavGrid = [];
		columns.forEach((column, index) => {
			column.forEach((row, rowIndex) => {
				while (result.length <= rowIndex) result.push([]);
				for (const node of row)
					result.at(rowIndex)?.push({ ...node, navColumn: index });
			});
		});
		return result;
	}
	cancelGameMenu(): boolean {
		const menu = this.menus.at(-1);
		if (!menu) return false;
		menu.Close();
		return true;
	}
	getDialogs(): NativeDialog[] {
		return [];
	}
	private bindProtectedEntry(frame: NativeDialogFrame, id: string): void {
		this.protectedEntries.set(frame, id);
		this.controls.bindSecureAction(frame, this.host.getAction(id));
	}
	private clearProtectedEntries(): void {
		for (const frame of this.protectedEntries.keys())
			this.controls.clearSecureAction(frame);
		this.protectedEntries.clear();
	}
	private close(): void {
		this.menus.at(0)?.Close();
		this.menus = [];
		this.clearProtectedEntries();
		this.host.release();
	}
	shutdown(): void {
		this.active = false;
		this.close();
		this.controls.release();
		this.prepare();
	}
}
