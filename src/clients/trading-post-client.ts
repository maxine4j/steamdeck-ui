import type { IEventBus } from "../events/types";
import type { Frame } from "../ui/components/frame";
import type { LayoutFrame, NativeLayout } from "../ui/components/native-layout";
import type {
	NativeNavigation,
	NativeNavigationFrame,
} from "../ui/components/native-navigation";
import type { INavigable, NavGrid } from "../ui/navigation/types";

interface Control extends NativeNavigationFrame {
	IsVisible(): boolean;
	IsEnabled?(): boolean;
	IsProtected?(): boolean;
	Click?(button: string): void;
	OpenMenu?(): void;
	CloseMenu?(): void;
	IsMenuOpen?(): boolean;
	readonly menu?: Control;
	GetChildren?(): LuaMultiReturn<Control[]>;
	GetScript(name: string): ((this: void, frame: Control) => void) | undefined;
}
interface Product {
	readonly isItemInfo?: boolean;
	readonly perksVendorItemID?: number;
	readonly purchased?: boolean;
}
interface ProductScroll {
	GetDataProvider(): { GetCollection(): Product[] } | undefined;
	ScrollToNearest(
		index: number,
		offset: undefined,
		noInterpolation: boolean,
	): void;
	FindFrame(data: Product): Control | undefined;
}
interface ProductsFrame {
	readonly PerksProgramFilter?: Control;
	readonly ProductsScrollBoxContainer: {
		readonly ScrollBox: ProductScroll;
		readonly NameSortButton?: Control;
		readonly PriceSortButton?: Control;
		readonly TimeSortButton?: Control;
	};
	readonly FrozenProductContainer?: { readonly ProductButton?: Control };
	readonly PerksProgramShoppingCartFrame?: {
		readonly CloseButton?: Control;
		readonly ClearCartButton?: Control;
		readonly PurchaseCartButton?: Control;
	};
}
type TradingPostFrame = LayoutFrame & {
	HookScript(script: string, callback: (this: void) => void): void;
	readonly ProductsFrame: ProductsFrame;
	readonly FooterFrame: Partial<
		Record<
			| "LeaveButton"
			| "PurchaseButton"
			| "RefundButton"
			| "AddToCartButton"
			| "RemoveFromCartButton"
			| "ViewCartButton"
			| "TogglePlayerPreview"
			| "ToggleMountSpecial"
			| "ToggleHideArmor"
			| "ToggleAttackAnimation",
			Control
		>
	> & {
		readonly RotateButtonContainer?: {
			readonly RotateLeftButton?: Control;
			readonly RotateRightButton?: Control;
		};
	};
	readonly ModelSceneContainerFrame?: {
		readonly AlteredFormButton?: Control;
		readonly NormalFormButton?: Control;
	};
};
interface LogicalNode {
	readonly node: INavigable;
	resolve: (this: void) => Control | undefined;
	reveal?: (this: void) => void;
	frame?: Control;
	focus?: INavigable;
}

export interface ITradingPostClient {
	disable(): void;
	restore(): void;
	isOpen(): boolean;
	presentation(available: { width: number; height: number }): {
		width: number;
		height: number;
	};
	mount(parent: Frame): void;
	resize(): void;
	unmount(): void;
	navigation(): NavGrid;
	dismissMenus(): boolean;
}

export class TradingPostClient implements ITradingPostClient {
	private enabled = false;
	private hooked = false;
	private attached?: TradingPostFrame;
	private parent?: Frame;
	private size?: readonly [number, number];
	private focused?: Control;
	private readonly nodes = new Map<string, LogicalNode>();
	private readonly changed = () => {
		if (this.parent) this.events.emit("TRADING_POST_CHANGED");
	};
	private readonly sync = () => {
		if (!this.enabled) return;
		const frame = this.frame();
		if (frame && this.attached !== frame) {
			this.attached = frame;
			frame.HookScript("OnShow", this.sync);
			frame.HookScript("OnHide", this.sync);
			frame.HookScript("OnEvent", this.changed);
			const hook = hooksecurefunc as unknown as (
				this: void,
				target: object,
				name: string,
				callback: (this: void) => void,
			) => void;
			for (const name of [
				"UpdateProducts",
				"SortFieldSet",
				"OnProductSelected",
			])
				hook(frame.ProductsFrame, name, () => this.changed());
			hook(frame.FooterFrame, "UpdateCartButtons", () => this.changed());
		}
		this.events.emit("TRADING_POST_VISIBILITY_CHANGED");
	};
	constructor(
		private readonly events: IEventBus,
		private readonly layout: Pick<NativeLayout, "bind" | "release">,
		private readonly focus: Pick<NativeNavigation, "navigation" | "release">,
	) {}
	private frame(): TradingPostFrame | undefined {
		return (_G as unknown as { PerksProgramFrame?: TradingPostFrame })
			.PerksProgramFrame;
	}
	disable(): void {
		this.enabled = true;
		if (!this.hooked) {
			this.hooked = true;
			hooksecurefunc("ShowUIPanel", () => this.sync());
		}
		this.sync();
	}
	restore(): void {
		this.enabled = false;
		this.unmount();
	}
	isOpen(): boolean {
		return this.enabled && this.frame()?.IsShown() === true;
	}
	presentation(available: { width: number; height: number }) {
		const frame = this.frame();
		const size = this.size ?? (frame ? [...frame.GetSize()] : undefined);
		if (!size) return available;
		const [width, height] = size;
		const scale = Math.min(available.width / width, available.height / height);
		return { width: width * scale, height: height * scale };
	}
	mount(parent: Frame): void {
		const frame = this.frame();
		if (!frame) return;
		this.parent = parent;
		const [width, height] = frame.GetSize();
		this.size = [width, height];
		this.resize();
	}
	resize(): void {
		const frame = this.frame();
		if (!frame || !this.parent || !this.size) return;
		const available = this.parent.getSize();
		const [width, height] = this.size;
		this.layout.bind(frame, {
			parent: this.parent,
			reparent: true,
			anchors: [["CENTER", "CENTER", 0, 0]],
			size: this.size,
			scale: Math.min(available.width / width, available.height / height),
			strata: "DIALOG",
			levelOffset: 1,
		});
	}
	unmount(): void {
		if (!this.parent) return;
		this.dismissMenus();
		this.parent = undefined;
		this.leave();
		this.focus.release();
		const frame = this.frame();
		if (frame?.IsShown()) HideUIPanel(frame);
		this.layout.release();
		this.size = undefined;
	}
	private leave(): void {
		const frame = this.focused;
		this.focused = undefined;
		frame?.GetScript("OnLeave")?.(frame);
	}
	private available(frame?: Control): frame is Control {
		return (
			frame?.IsVisible() === true &&
			frame.IsEnabled?.() !== false &&
			frame.IsProtected?.() !== true
		);
	}
	private node(
		id: string,
		resolve: (this: void) => Control | undefined,
		reveal?: (this: void) => void,
	): INavigable {
		const key = `trading-post-${id}`;
		let entry = this.nodes.get(key);
		if (!entry) {
			const node: INavigable = {
				navId: key,
				onFocus: (refresh) => {
					if (!refresh || !entry?.resolve()) entry?.reveal?.();
					const frame = entry?.resolve();
					if (!entry || !this.available(frame)) return;
					if (entry.frame !== frame) {
						entry.frame = frame;
						entry.focus = this.focus.navigation(
							frame,
							undefined,
							key,
							node.onInteract,
						);
					}
					entry.focus?.onFocus(refresh);
					if (this.focused !== frame) {
						this.leave();
						this.focused = frame;
						frame.GetScript("OnEnter")?.(frame);
					}
				},
				onBlur: () => {
					entry?.focus?.onBlur();
					this.leave();
				},
				onInteract: () => {
					const frame = entry?.resolve();
					if (!this.parent || !this.available(frame)) return;
					if (frame.OpenMenu) frame.OpenMenu();
					else if (
						!frame.GetScript("OnClick") &&
						frame.GetScript("OnMouseDown")
					) {
						frame.GetScript("OnMouseDown")?.(frame);
						frame.GetScript("OnMouseUp")?.(frame);
					} else frame.Click?.("LeftButton");
					this.changed();
				},
			};
			entry = { node, resolve, reveal };
			this.nodes.set(key, entry);
		}
		entry.resolve = resolve;
		entry.reveal = reveal;
		return entry.node;
	}
	dismissMenus(): boolean {
		const filter = this.frame()?.ProductsFrame.PerksProgramFilter;
		if (!filter?.IsMenuOpen?.()) return false;
		filter.CloseMenu?.();
		this.changed();
		return true;
	}
	navigation(): NavGrid {
		const frame = this.frame();
		if (!frame || !this.parent) return [];
		const products = frame.ProductsFrame;
		const filter = products.PerksProgramFilter;
		if (filter?.IsMenuOpen?.() && filter.menu) {
			const menu: NavGrid = [];
			const visit = (control: Control) => {
				if (!control.IsVisible()) return;
				if (control.Click && this.available(control))
					menu.push([this.node(`filter-option-${menu.length}`, () => control)]);
				else if (control.GetChildren)
					for (const child of [...control.GetChildren()]) visit(child);
			};
			visit(filter.menu);
			return menu;
		}
		const grid: NavGrid = [];
		const row = (
			controls: readonly (readonly [string, Control | undefined])[],
		) => {
			const nodes = controls
				.filter(([, control]) => this.available(control))
				.map(([id, control]) => this.node(id, () => control));
			if (nodes.length > 0) grid.push(nodes);
		};
		row([["filter", filter]]);
		const list = products.ProductsScrollBoxContainer;
		row([
			["sort-name", list.NameSortButton],
			["sort-price", list.PriceSortButton],
			["sort-time", list.TimeSortButton],
		]);
		const scroll = list.ScrollBox;
		for (const [index, data] of (
			scroll.GetDataProvider()?.GetCollection() ?? []
		).entries()) {
			if (!data.isItemInfo || data.perksVendorItemID === undefined) continue;
			const node = this.node(
				`product-${data.perksVendorItemID}`,
				() => scroll.FindFrame(data),
				() => scroll.ScrollToNearest(index + 1, undefined, true),
			);
			node.onContext = () => {
				const button = scroll.FindFrame(data);
				const frozen = products.FrozenProductContainer?.ProductButton;
				if (
					!this.parent ||
					data.purchased ||
					!this.available(button) ||
					!this.available(frozen)
				)
					return;
				const drag = button.GetScript("OnDragStart");
				if (!drag) return;
				// Use Blizzard's pickup/drop flow, including its server checks and
				// confirmation before replacing an already frozen item.
				drag(button);
				frozen.Click?.("LeftButton");
				this.changed();
			};
			grid.push([node]);
		}
		row([["frozen-product", products.FrozenProductContainer?.ProductButton]]);
		const model = frame.ModelSceneContainerFrame;
		row([
			["normal-form", model?.NormalFormButton],
			["altered-form", model?.AlteredFormButton],
		]);
		const footer = frame.FooterFrame;
		row([
			["rotate-left", footer.RotateButtonContainer?.RotateLeftButton],
			["rotate-right", footer.RotateButtonContainer?.RotateRightButton],
			["preview-player", footer.TogglePlayerPreview],
			["mount-special", footer.ToggleMountSpecial],
			["hide-armor", footer.ToggleHideArmor],
			["attack-animation", footer.ToggleAttackAnimation],
		]);
		const cart = products.PerksProgramShoppingCartFrame;
		row([
			["close-cart", cart?.CloseButton],
			["clear-cart", cart?.ClearCartButton],
			["purchase-cart", cart?.PurchaseCartButton],
		]);
		row([
			["leave", footer.LeaveButton],
			["purchase", footer.PurchaseButton],
			["refund", footer.RefundButton],
			["add-to-cart", footer.AddToCartButton],
			["remove-from-cart", footer.RemoveFromCartButton],
			["view-cart", footer.ViewCartButton],
		]);
		return grid;
	}
}
