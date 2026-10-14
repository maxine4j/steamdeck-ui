import type { IEventBus } from "../events/types";
import type { TransmogControl } from "../modules/transmog/wow-transmog-globals";
import type { Frame } from "../ui/components/frame";
import type { NativeLayout } from "../ui/components/native-layout";
import type { NativeNavigation } from "../ui/components/native-navigation";
import type { NativeVisibility } from "../ui/components/native-visibility";
import type { NavGrid } from "../ui/navigation/types";

export interface ITransmogClient {
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

export class TransmogClient implements ITransmogClient {
	private enabled = false;
	private hooked = false;
	private frameHooked = false;
	private parent?: Frame;
	private size?: readonly [number, number];
	private focused?: TransmogControl;
	private readonly controls = new Map<TransmogControl, string>();
	private readonly changed = () => {
		if (this.parent) this.events.emit("TRANSMOG_CHANGED");
	};
	private readonly sync = () => {
		if (!this.enabled) return;
		this.attach();
		this.events.emit("TRANSMOG_VISIBILITY_CHANGED");
	};
	constructor(
		private readonly layout: NativeLayout,
		private readonly focus: NativeNavigation,
		private readonly events: IEventBus,
		private readonly chrome: Pick<NativeVisibility, "hide" | "restore">,
	) {}
	private attach(): void {
		const frame = TransmogFrame;
		if (!frame || this.frameHooked) return;
		this.frameHooked = true;
		frame.HookScript("OnShow", this.sync);
		frame.HookScript("OnHide", this.sync);
		frame.HookScript("OnEvent", this.changed);
	}
	disable(): void {
		if (this.enabled) return;
		this.enabled = true;
		if (!this.hooked) {
			hooksecurefunc("ShowUIPanel", () => this.sync());
			this.hooked = true;
		}
		this.sync();
	}
	restore(): void {
		this.enabled = false;
		this.unmount();
	}
	isOpen(): boolean {
		return this.enabled && TransmogFrame?.IsShown() === true;
	}
	presentation(available: { width: number; height: number }) {
		const size =
			this.size ?? (TransmogFrame ? [...TransmogFrame.GetSize()] : undefined);
		if (!size) return available;
		const [width, height] = size;
		const scale = Math.min(available.width / width, available.height / height);
		return { width: width * scale, height: height * scale };
	}
	mount(parent: Frame): void {
		const frame = TransmogFrame;
		if (!frame) return;
		this.parent = parent;
		const [width, height] = frame.GetSize();
		this.size = [width, height];
		this.resize();
		this.chrome.hide(
			[
				frame.NineSlice,
				frame.PortraitContainer,
				frame.TitleContainer,
				frame.CloseButton,
				frame.HelpPlateButton,
			].filter((region) => region !== undefined),
		);
		HelpPlate.Hide(false);
	}
	resize(): void {
		const frame = TransmogFrame;
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
	private leave(): void {
		const frame = this.focused;
		this.focused = undefined;
		frame?.GetScript("OnLeave")?.(frame);
	}
	unmount(): void {
		if (!this.parent) return;
		this.parent = undefined;
		this.dismissMenus();
		this.leave();
		this.focus.release();
		// Close before restoring the parent so an already-hidden host cannot skip OnHide cleanup.
		if (TransmogFrame?.IsShown()) HideUIPanel(TransmogFrame);
		this.layout.release();
		this.chrome.restore();
		this.size = undefined;
	}
	private collect(frame: TransmogControl, result: TransmogControl[]): void {
		if (!frame.IsVisible()) return;
		if (!this.controls.has(frame)) {
			this.controls.set(
				frame,
				`transmog-${frame.GetName() ?? this.controls.size + 1}`,
			);
			frame.HookScript("OnShow", this.changed);
			frame.HookScript("OnHide", this.changed);
		}
		const actionable =
			frame.IsObjectType("DropdownButton") ||
			frame.IsObjectType("Button") ||
			frame.IsObjectType("EditBox") ||
			(frame.IsObjectType("DressUpModel") &&
				frame.GetScript("OnMouseDown") !== undefined);
		if (actionable && !frame.IsProtected() && frame.IsEnabled?.() !== false)
			result.push(frame);
		for (const child of [...frame.GetChildren()]) this.collect(child, result);
	}
	dismissMenus(): boolean {
		let dismissed = false;
		for (const frame of this.controls.keys()) {
			if (frame.IsMenuOpen?.()) {
				frame.CloseMenu?.();
				dismissed = true;
			}
		}
		if (dismissed) this.changed();
		return dismissed;
	}
	navigation(): NavGrid {
		if (!this.parent || !TransmogFrame) return [];
		const controls: TransmogControl[] = [];
		for (const child of [...TransmogFrame.GetChildren()])
			this.collect(child, controls);
		const menus: TransmogControl[] = [];
		for (const frame of controls) {
			if (frame.IsMenuOpen?.() && frame.menu) this.collect(frame.menu, menus);
		}
		// Blizzard parents dropdown menus outside the hosted transmog frame.
		const activeControls = menus.length > 0 ? menus : controls;
		const positioned: { frame: TransmogControl; x: number; y: number }[] = [];
		for (const frame of activeControls) {
			const [x, y] = frame.GetCenter();
			if (x === undefined || y === undefined) continue;
			const scale = frame.GetEffectiveScale();
			positioned.push({
				frame,
				x: Math.round(x * scale),
				y: Math.round(y * scale),
			});
		}
		positioned.sort((a, b) => b.y - a.y || a.x - b.x);
		const grid: NavGrid = [];
		let rowY: number | undefined;
		for (const { frame, x, y } of positioned) {
			if (rowY === undefined || Math.abs(rowY - y) > 4) {
				grid.push([]);
				rowY = y;
			}
			const node = this.focus.navigation(
				frame,
				undefined,
				this.controls.get(frame) ?? "transmog",
				() => {
					if (frame.IsObjectType("EditBox")) frame.SetFocus?.();
					else if (frame.OpenMenu) frame.OpenMenu();
					else if (frame.IsObjectType("Button") && frame.GetScript("OnClick"))
						frame.Click?.("LeftButton");
					else {
						frame.GetScript("OnMouseDown")?.(frame, "LeftButton");
						frame.GetScript("OnMouseUp")?.(frame, "LeftButton");
					}
					this.changed();
				},
			);
			grid.at(-1)?.push({
				...node,
				navColumn: x,
				onFocus: (refresh) => {
					node.onFocus(refresh);
					this.leave();
					this.focused = frame;
					frame.GetScript("OnEnter")?.(frame);
				},
				onBlur: () => {
					node.onBlur();
					if (this.focused === frame) this.leave();
				},
			});
		}
		return grid;
	}
}
