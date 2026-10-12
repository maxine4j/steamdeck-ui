import { expect, it, vi } from "vitest";
import type { IFramePoolManager } from "../frame-pool-manager";
import { Frame } from "./frame";
import { IconCheckbox } from "./icon-checkbox";

const { frames } = vi.hoisted(() => ({
	frames: new Map<
		string,
		{
			setLabel: ReturnType<typeof vi.fn>;
			show: ReturnType<typeof vi.fn>;
			hide: ReturnType<typeof vi.fn>;
			destroy: ReturnType<typeof vi.fn>;
			onClick: ReturnType<typeof vi.fn>;
			layout: ReturnType<typeof vi.fn>;
			setOpacity: ReturnType<typeof vi.fn>;
			setAtlasBackground: ReturnType<typeof vi.fn>;
			setButtonBackground: ReturnType<typeof vi.fn>;
		}
	>(),
}));
vi.mock("./frame", () => ({
	Frame: class {
		setLabel = vi.fn();
		show = vi.fn();
		hide = vi.fn();
		destroy = vi.fn();
		onClick = vi.fn();
		setParent = vi.fn();
		fill = vi.fn();
		layout = vi.fn();
		setBorder = vi.fn();
		setColor = vi.fn();
		setFocused = vi.fn();
		setCloseButtonBackground = vi.fn();
		setInsetBackground = vi.fn();
		setButtonBackground = vi.fn();
		setAtlasBackground = vi.fn();
		setWindowBackground = vi.fn();
		setOpacity = vi.fn();
		setTooltip = vi.fn();
		constructor(id: string) {
			frames.set(id, this);
		}
		navigationNode(navId: string, onInteract: () => void) {
			return { navId, onInteract, onFocus: vi.fn(), onBlur: vi.fn() };
		}
	},
}));

it("supports icon-only controls with equal padding around the artwork", () => {
	const pool = {} as IFramePoolManager;
	const control = new IconCheckbox("icon-only", pool, "Tank", "icon", vi.fn());
	control.mount(new Frame("parent", pool), 30, 70, false);
	expect(frames.get("icon-only")?.layout).toHaveBeenCalledWith(
		96,
		64,
		"TOPLEFT",
		expect.anything(),
		30,
		-70,
	);
	expect(frames.get("icon-only")?.setLabel).not.toHaveBeenCalled();
});

it("uses Blizzard checkbox artwork over the icon's bottom-left corner", () => {
	const pool = {} as IFramePoolManager;
	const control = new IconCheckbox("compact", pool, "Tank", "icon", vi.fn());
	control.mount(new Frame("parent", pool), 30, 70);
	expect(frames.get("compact-icon")?.layout).toHaveBeenCalledWith(
		48,
		48,
		"TOP",
		expect.anything(),
		0,
		-8,
	);
	expect(frames.get("compact-icon")?.setAtlasBackground).toHaveBeenCalledWith(
		"icon",
	);
	expect(frames.get("compact-box")?.layout).toHaveBeenCalledWith(
		21,
		20.3,
		"BOTTOMLEFT",
		frames.get("compact-icon"),
		-5,
		-4,
	);
	control.destroy();
	expect(frames.get("compact-icon")?.destroy).toHaveBeenCalledOnce();
});

it("shows an independent check mark and shares guarded mouse/controller activation", () => {
	const pool = {} as IFramePoolManager;
	const activate = vi.fn();
	const control = new IconCheckbox("role", pool, "Tank", "icon", activate);
	control.onInteract();
	expect(activate).not.toHaveBeenCalled();
	control.mount(new Frame("parent", pool), 30, 70);
	control.setChecked(true);
	expect(frames.get("role")?.setButtonBackground).not.toHaveBeenCalled();
	expect(frames.get("role-icon")?.setAtlasBackground).toHaveBeenLastCalledWith(
		"icon",
	);
	expect(frames.get("role-box")?.setAtlasBackground).toHaveBeenLastCalledWith(
		"checkbox-minimal",
	);
	expect(frames.get("role-check")?.setAtlasBackground).toHaveBeenLastCalledWith(
		"checkmark-minimal",
	);
	expect(frames.get("role-check")?.show).toHaveBeenCalled();
	control.setChecked(false);
	expect(frames.get("role-check")?.hide).toHaveBeenCalled();
	control.onInteract();
	frames.get("role")?.onClick.mock.lastCall?.at(0)("LeftButton");
	expect(activate).toHaveBeenCalledTimes(2);
	control.setChecked(true, false);
	expect(frames.get("role")?.setOpacity).toHaveBeenLastCalledWith(0.35);
	control.onInteract();
	expect(activate).toHaveBeenCalledTimes(2);
	control.setChecked(true, true);
	expect(frames.get("role")?.setOpacity).toHaveBeenLastCalledWith(1);
	control.unmount();
	control.onInteract();
	expect(activate).toHaveBeenCalledTimes(2);
	control.destroy();
	expect(frames.get("role-check")?.destroy).toHaveBeenCalledOnce();
});
