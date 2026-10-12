import { expect, it, vi } from "vitest";
import type { Frame } from "../components/frame";
import { PanelContainer } from "./panel-container";

it.each(["left", "right"] as const)(
	"keeps %s tabs flush against the container while switching panels",
	(position) => {
		const frame = {
			onClose: vi.fn(),
			dock: vi.fn(),
			show: vi.fn(),
			hide: vi.fn(),
			destroy: vi.fn(),
		} as unknown as Frame;
		const buttons: {
			onClick: ReturnType<typeof vi.fn>;
			setParent: ReturnType<typeof vi.fn>;
			layout: ReturnType<typeof vi.fn>;
			hide: ReturnType<typeof vi.fn>;
		}[] = [];
		const borders: Frame[] = [];
		const container = new PanelContainer(
			position,
			position,
			frame,
			(_id, isButton) => {
				const button = {
					setParent: vi.fn(),
					layout: vi.fn(),
					setIcon: vi.fn(),
					setTooltip: vi.fn(),
					setColor: vi.fn(),
					show: vi.fn(),
					hide: vi.fn(),
					destroy: vi.fn(),
					onClick: vi.fn(),
				};
				if (isButton) buttons.push(button);
				else borders.push(button as unknown as Frame);
				return button as unknown as Frame;
			},
		);
		const first = {
			id: "first",
			title: "First",
			icon: 1,
			onMount: vi.fn(),
			onUnmount: vi.fn(),
			getNavGrid: () => [],
		};
		const second = {
			...first,
			id: "second",
			onMount: vi.fn(),
			onUnmount: vi.fn(),
		};
		container.registerPanel(first);
		container.registerPanel(second);
		container.swapPanel(first);
		expect(first.onMount).toHaveBeenCalledOnce();
		expect(borders.at(0)?.layout).toHaveBeenCalledWith(
			44,
			44,
			position === "left" ? "RIGHT" : "LEFT",
			frame,
			position === "left" ? 44 : -44,
			24,
		);
		buttons.at(1)?.onClick.mock.calls.at(-1)?.at(0)("LeftButton");
		expect(first.onUnmount).toHaveBeenCalledOnce();
		expect(second.onMount).toHaveBeenCalledOnce();
		container.swapPanel(second);
		expect(second.onMount).toHaveBeenCalledOnce();
		expect(buttons.at(0)?.layout).toHaveBeenCalledWith(
			40,
			40,
			"CENTER",
			borders.at(0),
		);
		expect(buttons.at(1)?.layout).toHaveBeenCalledWith(
			40,
			40,
			"CENTER",
			borders.at(1),
		);
		expect(buttons.at(0)?.setParent).toHaveBeenCalledWith(borders.at(0));
		expect(buttons.at(1)?.setParent).toHaveBeenCalledWith(borders.at(1));
		container.popPanel();
		expect(first.onMount).toHaveBeenCalledOnce();
		expect(second.onUnmount).toHaveBeenCalledOnce();
		expect(frame.hide).toHaveBeenCalled();
		container.swapPanel(first);
		expect(buttons).toHaveLength(2);
		container.clear();
	},
);

it.each(["left", "right", "fullscreen"] as const)(
	"closes the entire %s container through the shared frame close handler and can reopen",
	(position) => {
		const onClose = vi.fn();
		const frame = {
			dock: vi.fn(),
			onClose,
			show: vi.fn(),
			hide: vi.fn(),
			destroy: vi.fn(),
		} as unknown as Frame;
		const container = new PanelContainer(position, position, frame);
		const first = {
			id: "first",
			title: "First",
			onMount: vi.fn(),
			onUnmount: vi.fn(),
			getNavGrid: () => [],
		};
		const second = {
			...first,
			id: "second",
			onMount: vi.fn(),
			onUnmount: vi.fn(),
		};
		container.pushPanel(first);
		container.pushPanel(second);
		onClose.mock.calls.at(-1)?.at(0)();
		expect(container.activePanelId).toBeUndefined();
		expect(second.onUnmount).toHaveBeenCalledOnce();
		expect(first.onUnmount).toHaveBeenCalledOnce();
		container.swapPanel(second);
		expect(second.onMount).toHaveBeenCalledTimes(2);
		container.popPanel();
		expect(container.activePanelId).toBeUndefined();
	},
);
