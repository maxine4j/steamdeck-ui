import type { INavigable, NavGrid } from "../navigation/types";
import type {
	NativeNavigation,
	NativeNavigationFrame,
} from "./native-navigation";

export interface NativeDialogFrame extends NativeNavigationFrame {
	GetChildren(): LuaMultiReturn<NativeDialogFrame[]>;
	IsVisible(): boolean;
	IsObjectType(type: string): boolean;
	IsEnabled(): boolean;
	GetLeft(): number;
	Click(button?: string): void;
	OpenMenu?(): void;
	CloseMenu?(): void;
	SetFocus?(): void;
	GetElementDescription?(): {
		CanOpenSubmenu(): boolean;
		ForceOpenSubmenu(): void;
	};
	HookScript(script: string, callback: (this: void) => void): void;
	GetScript(
		script: string,
	): ((this: void, frame: NativeDialogFrame) => void) | undefined;
}

export interface NativeDialogList<T> {
	ForEachElementData(callback: (this: void, data: T) => void): void;
	ScrollToElementData(
		data: T,
		alignment: number,
		offset: number,
		instant: boolean,
	): void;
	FindFrame(data: T): NativeDialogFrame | undefined;
}

export interface NativeDialogMenu extends NativeDialogFrame {
	Close?(): void;
	ScrollBox?: NativeDialogFrame & NativeDialogList<NativeDialogFrame>;
}

interface NativeActionMenu extends NativeDialogFrame {
	AddButton(text: string, callback: (this: void) => void): void;
	InitButtons(): void;
}

/** Adapts native dialogs and pooled menu actions for controller navigation. */
export class NativeDialogNavigation {
	private readonly observers = new Map<NativeDialogFrame, () => void>();
	private readonly hooked = new Set<NativeDialogFrame>();
	private readonly ids = new Map<NativeDialogFrame, number>();
	private readonly menus = new Set<NativeActionMenu>();
	constructor(
		private readonly navigation: Pick<
			NativeNavigation,
			"navigation" | "release"
		>,
	) {}
	/** Uses the host menu's pooled template, layout and narration support. */
	addMenuAction(
		frame: NativeDialogFrame,
		label: string,
		action: (this: void) => void,
	): void {
		const menu = frame as NativeActionMenu;
		this.menus.add(menu);
		menu.AddButton(label, action);
	}
	watch(frame: NativeDialogFrame, changed: () => void): void {
		this.observers.set(frame, changed);
		this.observe(frame, frame);
	}
	private observe(frame: NativeDialogFrame, root: NativeDialogFrame): void {
		if (this.hooked.has(frame)) return;
		this.hooked.add(frame);
		const notify = () => this.observers.get(root)?.();
		frame.HookScript("OnShow", notify);
		frame.HookScript("OnHide", notify);
		if (frame.OpenMenu) {
			const hook = hooksecurefunc as unknown as (
				this: void,
				frame: NativeDialogFrame,
				method: string,
				callback: (this: void) => void,
			) => void;
			hook(frame, "OpenMenu", notify);
			if (frame.CloseMenu) hook(frame, "CloseMenu", notify);
		}
		if (frame.IsObjectType("Button")) {
			const hook = hooksecurefunc as unknown as (
				this: void,
				frame: NativeDialogFrame,
				method: string,
				callback: (this: void) => void,
			) => void;
			for (const method of ["Enable", "Disable", "SetEnabled"])
				hook(frame, method, notify);
		}
	}
	grid(id: string, root: NativeDialogFrame, vertical = false): NavGrid {
		const buttons: NativeDialogFrame[] = [];
		const visit = (frame: NativeDialogFrame) => {
			this.observe(frame, root);
			if (!frame.IsVisible()) return;
			if (
				frame !== root &&
				(frame.IsObjectType("Button") ||
					frame.IsObjectType("DropdownButton") ||
					frame.IsObjectType("EditBox"))
			) {
				if (frame.IsEnabled()) buttons.push(frame);
				// Focus outlines and other button decorations are not controls.
				return;
			}
			for (const child of [...frame.GetChildren()]) visit(child);
		};
		visit(root);
		buttons.sort((a, b) =>
			Math.abs(a.GetTop() - b.GetTop()) > 8
				? b.GetTop() - a.GetTop()
				: a.GetLeft() - b.GetLeft(),
		);
		const grid: NavGrid = [];
		let top: number | undefined;
		for (const button of buttons) {
			if (!this.ids.has(button)) this.ids.set(button, this.ids.size + 1);
			if (
				vertical ||
				top === undefined ||
				Math.abs(button.GetTop() - top) > 8
			) {
				grid.push([]);
				top = button.GetTop();
			}
			grid.at(-1)?.push(this.control(`${id}:${this.ids.get(button)}`, button));
		}
		return grid;
	}
	control(id: string, frame: NativeDialogFrame): INavigable {
		return this.navigation.navigation(
			frame,
			undefined,
			id,
			() => this.click(frame),
			{
				enter: () => frame.GetScript("OnEnter")?.(frame),
				leave: () => frame.GetScript("OnLeave")?.(frame),
			},
		);
	}
	/** Retail menus store the actual controls as ScrollBox data, inside wrappers. */
	menu(id: string, menu: NativeDialogMenu): NavGrid {
		const scroll = menu.ScrollBox;
		if (!scroll?.IsVisible()) return this.grid(id, menu, true);
		return this.list<{ data: NativeDialogFrame; control: NativeDialogFrame }>(
			id,
			{
				ForEachElementData: (callback) =>
					scroll.ForEachElementData((data) => {
						const visit = (frame: NativeDialogFrame) => {
							if (
								frame.IsObjectType("Button") ||
								frame.IsObjectType("DropdownButton") ||
								frame.IsObjectType("EditBox")
							) {
								if (frame.IsEnabled()) callback({ data, control: frame });
								return;
							}
							for (const child of [...frame.GetChildren()]) visit(child);
						};
						visit(data);
					}),
				ScrollToElementData: (entry, alignment, offset, instant) =>
					scroll.ScrollToElementData(entry.data, alignment, offset, instant),
				FindFrame: (entry) =>
					entry.control.IsVisible() ? entry.control : undefined,
			},
			({ control: frame }) => {
				if (!this.ids.has(frame)) this.ids.set(frame, this.ids.size + 1);
				return `${this.ids.get(frame)}`;
			},
		);
	}
	/** Logical nodes survive ScrollBox recycling; resolve frames only when used. */
	list<T>(
		id: string,
		scroll: NativeDialogList<T>,
		key: (data: T) => string,
		context?: (frame: NativeDialogFrame) => NativeDialogFrame | undefined,
		primary?: (frame: NativeDialogFrame) => NativeDialogFrame | undefined,
	): NavGrid {
		const grid: NavGrid = [];
		scroll.ForEachElementData((data) => {
			const navId = `${id}:${key(data)}`;
			let focused: INavigable | undefined;
			grid.push([
				{
					navId,
					onFocus: (refresh) => {
						if (!refresh || !scroll.FindFrame(data))
							scroll.ScrollToElementData(data, 0.5, 0, true);
						const frame = scroll.FindFrame(data);
						if (!frame) return;
						focused = this.control(navId, frame);
						focused.onFocus(refresh);
					},
					onBlur: () => {
						focused?.onBlur();
						focused = undefined;
					},
					onInteract: () => {
						const row = scroll.FindFrame(data);
						const frame = row && (primary ? primary(row) : row);
						if (frame) this.click(frame);
					},
					onContext: context
						? () => {
								const row = scroll.FindFrame(data);
								const frame = row && context(row);
								if (frame) this.click(frame);
							}
						: undefined,
				},
			]);
		});
		return grid;
	}
	click(frame: NativeDialogFrame): void {
		if (!frame.IsVisible() || !frame.IsEnabled()) return;
		if (frame.IsObjectType("EditBox")) frame.SetFocus?.();
		else if (frame.OpenMenu) frame.OpenMenu();
		else if (frame.GetElementDescription?.().CanOpenSubmenu())
			frame.GetElementDescription().ForceOpenSubmenu();
		else frame.Click("LeftButton");
	}
	release(): void {
		this.observers.clear();
		for (const menu of this.menus) menu.InitButtons();
		this.menus.clear();
		this.navigation.release();
	}
}
