import { expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import type { Frame } from "../components/frame";
import { NavigationManager } from "../navigation/navigation-manager";
import { PanelContainer } from "./panel-container";

it("closes the active panel on controller cancel when it has no back handler", () => {
	const events = createTestEventBus();
	const navigation = new NavigationManager(events);
	const frame = {
		dock: vi.fn(),
		onClose: vi.fn(),
		show: vi.fn(),
		hide: vi.fn(),
		setFocusBorder: vi.fn(),
	} as unknown as Frame;
	const container = new PanelContainer(
		"right",
		"right",
		frame,
		undefined,
		undefined,
		navigation,
	);
	const closed = vi.fn();
	container.swapPanel({
		id: "panel",
		title: "Panel",
		onMount: vi.fn(),
		onUnmount: vi.fn(),
		getNavGrid: () => [],
		onContainerClosed: closed,
	});
	events.emit("NAV_CANCEL");
	expect(container.activePanelId).toBeUndefined();
	expect(closed).toHaveBeenCalledOnce();
});

it("forwards B to the current panel after switching tabs", () => {
	const events = createTestEventBus();
	const navigation = new NavigationManager(events);
	const frame = {
		onClose: vi.fn(),
		dock: vi.fn(),
		show: vi.fn(),
		hide: vi.fn(),
		setFocusBorder: vi.fn(),
	} as unknown as Frame;
	const container = new PanelContainer(
		"right",
		"right",
		frame,
		undefined,
		undefined,
		navigation,
	);
	const first = vi.fn();
	const second = vi.fn();
	const panel = (id: string, onBack: () => void) => ({
		id,
		title: id,
		onMount: vi.fn(),
		onUnmount: vi.fn(),
		getNavGrid: () => [],
		onBack,
	});
	container.swapPanel(panel("first", first));
	container.focus();
	events.emit("NAV_CANCEL");
	expect(first).toHaveBeenCalledOnce();
	container.swapPanel(panel("second", second));
	events.emit("NAV_CANCEL");
	expect(second).toHaveBeenCalledOnce();
	expect(first).toHaveBeenCalledOnce();
});

it("notifies content when its container closes but not when tabs switch", () => {
	let hide = () => {};
	const frame = {
		dock: vi.fn(),
		onClose: (callback: () => void) => {
			hide = callback;
		},
		show: vi.fn(),
		hide: vi.fn(),
	} as unknown as Frame;
	const container = new PanelContainer("left", "left", frame);
	const closed = vi.fn();
	const panel = (id: string) => ({
		id,
		title: id,
		onMount: vi.fn(),
		onUnmount: vi.fn(),
		onContainerClosed: closed,
		getNavGrid: () => [],
	});
	container.swapPanel(panel("vendor"));
	container.swapPanel(panel("buyback"));
	expect(closed).not.toHaveBeenCalled();
	container.popPanel();
	expect(closed).toHaveBeenCalledOnce();
	hide();
	expect(closed).toHaveBeenCalledOnce();
	container.swapPanel(panel("vendor"));
	hide();
	expect(closed).toHaveBeenCalledTimes(2);
});

it.each(["left", "right"] as const)(
	"keeps %s tabs flush against the container while switching panels",
	(position) => {
		const events = createTestEventBus();
		const navigation = new NavigationManager(events);
		const frame = {
			setFocusBorder: vi.fn(),
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
					navigationNode: vi.fn((navId: string, interact: () => void) => ({
						navId,
						onFocus: vi.fn(),
						onBlur: vi.fn(),
						onInteract: interact,
					})),
				};
				if (isButton) buttons.push(button);
				else borders.push(button as unknown as Frame);
				return button as unknown as Frame;
			},
			undefined,
			navigation,
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
		expect(navigation.focusedId).toBeUndefined();
		events.emit("NAV_PANEL_NEXT");
		expect(container.activePanelId).toBe("second");
		events.emit("NAV_PANEL_NEXT");
		expect(container.activePanelId).toBe("first");
		events.emit("NAV_PANEL_PREVIOUS");
		expect(container.activePanelId).toBe("second");
		container.clear();
		expect(navigation.focusedId).toBeUndefined();
	},
);

it("switches content with bumpers, moves the gold border with triggers and restores item focus", () => {
	const events = createTestEventBus();
	const navigation = new NavigationManager(events);
	const makeFrame = () => ({
		dock: vi.fn(),
		onClose: vi.fn(),
		show: vi.fn(),
		hide: vi.fn(),
		destroy: vi.fn(),
		setFocusBorder: vi.fn(),
	});
	const leftFrame = makeFrame();
	const rightFrame = makeFrame();
	const selected = vi.fn();
	const left = new PanelContainer(
		"left",
		"left",
		leftFrame as unknown as Frame,
		undefined,
		selected,
		navigation,
		{ right: "right" },
	);
	const right = new PanelContainer(
		"right",
		"right",
		rightFrame as unknown as Frame,
		undefined,
		undefined,
		navigation,
		{ left: "left" },
	);
	const makePanel = (id: string) => ({
		id,
		title: id,
		onMount: vi.fn(),
		onUnmount: vi.fn(),
		getNavGrid: () => [
			[0, 1].map((index) => ({
				navId: `${id}-${index}`,
				onFocus: vi.fn(),
				onBlur: vi.fn(),
				onInteract: vi.fn(),
			})),
		],
	});
	const paperDoll = makePanel("paper-doll");
	const titles = makePanel("titles");
	const bags = makePanel("bags");
	left.registerPanel(paperDoll);
	left.registerPanel(titles);
	left.swapPanel(paperDoll);
	right.swapPanel(bags);
	expect(leftFrame.setFocusBorder).toHaveBeenLastCalledWith(false);
	expect(rightFrame.setFocusBorder).toHaveBeenLastCalledWith(true);
	events.emit("NAV_RIGHT");
	events.emit("NAV_CONTAINER_LEFT");
	expect(leftFrame.setFocusBorder).toHaveBeenLastCalledWith(true);
	expect(rightFrame.setFocusBorder).toHaveBeenLastCalledWith(false);
	events.emit("NAV_PANEL_NEXT");
	expect(selected).toHaveBeenCalledExactlyOnceWith(titles);
	expect(paperDoll.onUnmount).toHaveBeenCalledOnce();
	expect(titles.onMount).toHaveBeenCalledOnce();
	expect(left.activePanelId).toBe("titles");
	expect(right.activePanelId).toBe("bags");
	expect(navigation.focusedId).toBe("titles-0");
	events.emit("NAV_CONTAINER_RIGHT");
	expect(navigation.focusedId).toBe("bags-1");
	events.emit("NAV_CONTAINER_LEFT");
	expect(navigation.focusedId).toBe("titles-0");
	left.popPanel();
	expect(leftFrame.setFocusBorder).toHaveBeenLastCalledWith(false);
	expect(rightFrame.setFocusBorder).toHaveBeenLastCalledWith(true);
	events.emit("NAV_CONTAINER_LEFT");
	expect(navigation.focusedId).toBe("bags-1");
	right.clear();
	expect(rightFrame.setFocusBorder).toHaveBeenLastCalledWith(false);
});

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
