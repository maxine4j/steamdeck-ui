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
		constructor(id: string) {
			frames.set(id, this);
		}
		navigationNode(navId: string, onInteract: () => void) {
			return { navId, onInteract, onFocus: vi.fn(), onBlur: vi.fn() };
		}
	},
}));

it("shows an independent check mark and shares guarded mouse/controller activation", () => {
	const pool = {} as IFramePoolManager;
	const activate = vi.fn();
	const control = new IconCheckbox("role", pool, "Tank", "icon", activate);
	control.onInteract();
	expect(activate).not.toHaveBeenCalled();
	control.mount(new Frame("parent", pool), 30, 70);
	control.setChecked(true);
	expect(frames.get("role-check")?.show).toHaveBeenCalled();
	control.setChecked(false);
	expect(frames.get("role-check")?.hide).toHaveBeenCalled();
	control.onInteract();
	frames.get("role")?.onClick.mock.lastCall?.at(0)("LeftButton");
	expect(activate).toHaveBeenCalledTimes(2);
	control.setChecked(true, false);
	control.onInteract();
	expect(activate).toHaveBeenCalledTimes(2);
	control.unmount();
	control.onInteract();
	expect(activate).toHaveBeenCalledTimes(2);
	control.destroy();
	expect(frames.get("role-check")?.destroy).toHaveBeenCalledOnce();
});
