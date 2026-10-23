import { beforeEach, expect, it, vi } from "vitest";
import type { ControllerOption } from "../../clients/controller-options-client";
import { createTestEventBus } from "../../events/test-event-bus";
import type { ListRow } from "../../ui/components/scroll-list";
import type { IUIComponent } from "../../ui/components/types";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { INavigable } from "../../ui/navigation/types";
import { ControllerOptionsModule } from "./controller-options-module";
import { ControllerOptionsPanel } from "./controller-options-panel";

const state = vi.hoisted(() => ({
	rows: [] as readonly ListRow[],
	nodes: [] as INavigable[],
	mounts: 0,
	destroys: 0,
	width: 0,
	listOptions: {} as { columns?: number; gap?: number },
	viewportWidth: 1200,
	resized: undefined as (() => void) | undefined,
}));
beforeEach(() => {
	state.mounts = 0;
	state.destroys = 0;
	state.nodes = [];
});
vi.mock("../../ui/components/frame", () => ({
	Frame: class {
		fill() {}
		show() {}
		hide() {}
		destroy() {}
		onSizeChanged(callback?: () => void) {
			state.resized = callback;
		}
		getSize() {
			return { width: state.viewportWidth, height: 720 };
		}
	},
}));
vi.mock("../../ui/components/scroll-list", () => ({
	ScrollList: class {
		constructor(
			_id: string,
			_pool: IFramePoolManager,
			_title: string,
			_close: () => void,
			options: typeof state.listOptions,
		) {
			state.listOptions = options;
		}
		updateRows(rows: readonly ListRow[]) {
			state.rows = rows;
		}
		mount() {
			state.mounts++;
		}
		unmount() {}
		resetScroll() {}
		destroy() {
			state.destroys++;
		}
		getNavGrid() {
			return state.rows
				.filter((row) => !row.heading && row.enabled !== false)
				.map((row, index) => {
					const node = state.nodes.at(index) ?? {
						navId: row.id,
						onFocus() {},
						onBlur() {},
						onInteract: row.activate,
					};
					node.navId = row.id;
					node.onInteract = row.activate;
					state.nodes[index] = node;
					return [node];
				});
		}
		setWidth(width: number) {
			state.width = width;
		}
	},
}));

it("fits the fullscreen viewport and updates row width when the window resizes", () => {
	const panel = new ControllerOptionsPanel(
		{} as IFramePoolManager,
		{ getOptions: () => [], set: vi.fn(), reset: vi.fn() },
		vi.fn(),
	);
	panel.onMount({} as IUIComponent);
	expect(state.listOptions).toMatchObject({ columns: 2, gap: 16 });
	expect(state.width).toBe(1200);
	state.viewportWidth = 950;
	state.resized?.();
	expect(state.width).toBe(950);
	panel.onUnmount();
	expect(state.resized).toBeUndefined();
	state.viewportWidth = 1200;
});

it("opens direct choices, selects a value, cancels without edits, resets and closes", () => {
	let current = "never";
	const choices = [
		{ value: "never", label: "Never" },
		{ value: "combat", label: "In combat" },
		{ value: "always", label: "Always" },
		{ value: "outOfCombat", label: "Outside combat" },
	];
	const client = {
		getOptions: (): ControllerOption[] => [
			{
				id: "facing",
				label: "Camera turns character",
				description: "When to face",
				category: "Camera control",
				choices,
				value: current,
				supported: true,
			},
			{
				id: "missing",
				label: "Unavailable option",
				description: "Missing",
				category: "Camera control",
				choices,
				value: current,
				supported: false,
			},
		],
		set: vi.fn((_id: string, value: string) => {
			current = value;
		}),
		reset: vi.fn(() => {
			current = "never";
		}),
	};
	const close = vi.fn();
	const panel = new ControllerOptionsPanel(
		{} as IFramePoolManager,
		client,
		close,
	);
	panel.onMount({} as IUIComponent);
	expect(
		state.rows.find((row) => row.id === "option-facing")?.secondary,
	).toBeUndefined();
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((node) => node.navId === "option-missing"),
	).toBe(false);
	state.rows.find((row) => row.id === "option-missing")?.activate();
	expect(client.set).not.toHaveBeenCalled();
	state.rows.find((row) => row.id === "option-facing")?.activate();
	expect(client.set).not.toHaveBeenCalled();
	expect(
		state.rows
			.filter((row) => row.id.startsWith("choice-"))
			.map((row) => row.label),
	).toEqual(choices.map((choice) => choice.label));
	expect(
		state.rows.find((row) => row.id === "choice-facing-never")?.checked,
	).toBe(true);
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "choice-facing-outOfCombat")
		?.onInteract();
	expect(client.set).toHaveBeenCalledExactlyOnceWith("facing", "outOfCombat");
	expect(state.rows.find((row) => row.id === "option-facing")?.label).toContain(
		"Outside combat",
	);
	state.rows.find((row) => row.id === "option-facing")?.activate();
	panel.getNavGrid().at(0)?.at(0)?.navigationScope?.cancel();
	expect(client.set).toHaveBeenCalledTimes(1);
	expect(state.rows.some((row) => row.id === "option-facing")).toBe(true);
	expect(
		panel
			.getNavGrid()
			.flat()
			.every((node) => node.navigationScope === undefined),
	).toBe(true);
	state.rows.find((row) => row.id === "option-facing")?.activate();
	state.rows.find((row) => row.id === "choices-back")?.activate();
	expect(client.set).toHaveBeenCalledTimes(1);
	state.rows.find((row) => row.id === "options-reset")?.activate();
	expect(client.reset).toHaveBeenCalledOnce();
	state.rows.find((row) => row.id === "options-close")?.activate();
	expect(close).toHaveBeenCalledOnce();
	state.rows.find((row) => row.id === "option-facing")?.activate();
	panel.onUnmount();
	panel.onMount({} as IUIComponent);
	expect(state.rows.some((row) => row.id === "option-facing")).toBe(true);
	expect(state.mounts).toBe(2);
	panel.destroy();
	expect(state.destroys).toBe(1);
});

it("registers a fullscreen options window, opens on menu request and detaches on shutdown", () => {
	const events = createTestEventBus();
	const ui = {
		registerPanel: vi.fn(),
		openPanel: vi.fn(),
		closePanel: vi.fn(),
	};
	const panel = new ControllerOptionsPanel(
		{} as IFramePoolManager,
		{ getOptions: () => [], set: vi.fn(), reset: vi.fn() },
		vi.fn(),
	);
	const module = new ControllerOptionsModule(ui, events, panel);
	module.disableBuiltIn();
	module.initialize();
	expect(ui.registerPanel).toHaveBeenCalledWith(
		panel,
		"fullscreen",
		"controller-options",
	);
	events.emit("CONTROLLER_OPTIONS_OPEN_REQUESTED");
	expect(ui.openPanel).toHaveBeenCalledWith(
		"controller-options",
		"fullscreen",
		"controller-options",
	);
	module.shutdown();
	expect(ui.closePanel).toHaveBeenCalledWith(
		"fullscreen",
		undefined,
		"controller-options",
	);
	ui.openPanel.mockClear();
	events.emit("CONTROLLER_OPTIONS_OPEN_REQUESTED");
	expect(ui.openPanel).not.toHaveBeenCalled();
});
