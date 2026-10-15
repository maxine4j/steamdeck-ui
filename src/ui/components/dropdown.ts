import type { WowFrame } from "../../types";
import type { IFramePoolManager } from "../frame-pool-manager";
import type { INavigable } from "../navigation/types";
import { Frame } from "./frame";
import type { NativeDropdownButton } from "./native-menu";

declare const MenuResponse: { Refresh: number; Close: number };
declare const MenuInputContext: { None: number };

export interface DropdownOption {
	readonly id: string;
	readonly label: string;
	/** Defined for checkbox options, including unchecked options. */
	readonly checked?: boolean;
	readonly selected?: boolean;
	activate(): void;
}

export class Dropdown {
	readonly button: Frame;
	private native?: NativeDropdownButton;
	private options: DropdownOption[] = [];
	private nodes: INavigable[][] = [];
	private focusedId?: string;
	constructor(
		id: string,
		pool: IFramePoolManager,
		private readonly navigationChanged?: (focusId?: string) => void,
	) {
		this.button = new Frame(id, pool, "FilterDropdown");
	}
	mount(parent: Frame): void {
		this.button.setParent(parent);
		this.button.layout(90, 18, "TOPRIGHT", parent, -16, -66);
		if (!this.native) {
			this.native = this.button.getDropdownButton();
			this.native.resizeToText = false;
			this.native.RegisterCallback(
				"OnMenuOpen",
				() => this.navigationChanged?.(this.nodes.at(0)?.at(0)?.navId),
				this,
			);
			this.native.RegisterCallback(
				"OnMenuClose",
				() => {
					this.focusedId = undefined;
					this.navigationChanged?.(this.button.id);
				},
				this,
			);
		}
		this.button.show();
		this.setOptions(this.options);
	}
	setOptions(options: DropdownOption[]): void {
		this.options = options;
		this.native?.SetupMenu((_button, root) => {
			root.SetScrollMode(360);
			this.nodes = options.map((option, index): INavigable[] => {
				const respond = () => {
					this.navigationChanged?.(option.id);
					option.activate();
					return option.checked !== undefined
						? MenuResponse.Refresh
						: MenuResponse.Close;
				};
				const description =
					option.checked !== undefined
						? root.CreateCheckbox(
								option.label,
								() => option.checked === true,
								respond,
							)
						: option.selected !== undefined
							? root.CreateRadio(
									option.label,
									() => option.selected === true,
									respond,
								)
							: root.CreateButton(option.label, respond);
				let frame: WowFrame | undefined;
				description.AddInitializer((native) => {
					frame = native;
					if (this.isOpen() && this.focusedId === option.id)
						description.HandleOnEnter(native);
				});
				return [
					{
						navId: option.id,
						onFocus: () => {
							this.focusedId = option.id;
							if (this.isOpen() && frame) {
								this.native?.menu?.ScrollBox.ScrollToNearest(
									index + 1,
									0,
									true,
								);
								description.HandleOnEnter(frame);
							}
						},
						onBlur: () => {
							this.focusedId = undefined;
							if (this.isOpen() && frame) description.HandleOnLeave(frame);
						},
						onInteract: () => {
							if (this.isOpen())
								description.Pick(MenuInputContext.None, "LeftButton");
						},
					},
				];
			});
		});
		if (this.isOpen()) this.navigationChanged?.();
	}
	hide(): void {
		this.native?.CloseMenu();
	}
	getNavGrid(): INavigable[][] {
		return [
			[
				{
					navId: this.button.id,
					onFocus: (refresh) => {
						if (refresh) this.button.setFocused(true, false, true);
						else this.button.setFocused(true);
					},
					onBlur: () => this.button.setFocused(false),
					onInteract: () => this.native?.SetMenuOpen(!this.isOpen()),
				},
			],
			...(this.isOpen() ? this.nodes : []),
		];
	}
	isOpen(): boolean {
		return this.native?.IsMenuOpen() ?? false;
	}
	destroy(): void {
		this.hide();
		this.native?.UnregisterCallback("OnMenuOpen", this);
		this.native?.UnregisterCallback("OnMenuClose", this);
		this.native?.ClearMenuState();
		this.native = undefined;
		this.nodes = [];
		this.button.destroy();
	}
}
