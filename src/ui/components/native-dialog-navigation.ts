import type { NavGrid } from "../navigation/types";
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
	Click(): void;
	HookScript(script: string, callback: (this: void) => void): void;
	GetScript(
		script: string,
	): ((this: void, frame: NativeDialogFrame) => void) | undefined;
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
			if (frame !== root && frame.IsObjectType("Button")) {
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
			grid.at(-1)?.push(
				this.navigation.navigation(
					button,
					undefined,
					`${id}:${this.ids.get(button)}`,
					() => this.click(button),
					{
						enter: () => button.GetScript("OnEnter")?.(button),
						leave: () => button.GetScript("OnLeave")?.(button),
					},
				),
			);
		}
		return grid;
	}
	click(frame: NativeDialogFrame): void {
		if (frame.IsVisible() && frame.IsEnabled()) frame.Click();
	}
	release(): void {
		this.observers.clear();
		for (const menu of this.menus) menu.InitButtons();
		this.menus.clear();
		this.navigation.release();
	}
}
