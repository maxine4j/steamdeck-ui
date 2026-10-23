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
	frames: new Map<
		string,
		{
			layout: ReturnType<typeof vi.fn>;
			setColor: ReturnType<typeof vi.fn>;
			setLabel: ReturnType<typeof vi.fn>;
			setFocusBorder: ReturnType<typeof vi.fn>;
			setWindowBackground: ReturnType<typeof vi.fn>;
		}
	>(),
	resized: undefined as (() => void) | undefined,
}));
beforeEach(() => {
	state.mounts = 0;
	state.destroys = 0;
	state.nodes = [];
});
vi.mock("../../ui/components/frame", () => ({
	Frame: class {
		constructor(id: string) {
			state.frames.set(id, this);
		}
		layout = vi.fn();
		setColor = vi.fn();
		setLabel = vi.fn();
		setFocusBorder = vi.fn();
		setWindowBackground = vi.fn();
		setParent() {}
		setTooltip() {}
		onClick() {}
		setFocused() {}
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

it("centers a narrower window and fits its focus outline when the viewport resizes", () => {
	const panel = new ControllerOptionsPanel(
		{} as IFramePoolManager,
		{ getOptions: () => [], set: vi.fn(), reset: vi.fn() },
		vi.fn(),
	);
	panel.onMount({} as IUIComponent);
	expect(state.listOptions).toMatchObject({ columns: 2, gap: 16 });
	expect(state.width).toBe(792);
	expect(
		state.frames.get("controller-options-window")?.setWindowBackground,
	).toHaveBeenCalledOnce();
	expect(state.listOptions).toMatchObject({ background: false });
	expect(
		state.frames.get("controller-options-window")?.layout,
	).toHaveBeenLastCalledWith(792, 720, "CENTER", expect.anything());
	panel.onActiveChanged(true);
	expect(
		state.frames.get("controller-options-window")?.setFocusBorder,
	).toHaveBeenLastCalledWith(true);
	state.viewportWidth = 950;
	state.resized?.();
	expect(state.width).toBe(627);
	panel.onUnmount();
	expect(state.resized).toBeUndefined();
	state.viewportWidth = 1200;
});

it("shows inline radio groups and sensitivity sliders, saves immediately and resets", () => {
	let movement = "face";
	let speed = "1";
	const client = {
		getOptions: (): ControllerOption[] => [
			{
				id: "travelStyle",
				category: "Movement",
				label: "Movement outside combat",
				description: "Choose movement",
				choices: [
					{ value: "face", label: "Face movement stick" },
					{ value: "backpedal", label: "Strafe and backpedal" },
					{ value: "mixed", label: "Strafe, then face stick" },
				],
				value: movement,
				supported: true,
			},
			...["yawSpeed", "pitchSpeed"].map((id) => ({
				id,
				category: "Camera control",
				label: id,
				description: "Sensitivity",
				choices: [
					{ value: "0.5", label: "0.5" },
					{ value: "0.75", label: "0.75" },
					{ value: "1", label: "1" },
					{ value: "1.25", label: "1.25" },
				],
				value: speed,
				supported: id === "yawSpeed",
			})),
		],
		set: vi.fn((id: string, value: string) => {
			if (id === "travelStyle") movement = value;
			else speed = value;
		}),
		reset: vi.fn(),
	};
	const close = vi.fn();
	const panel = new ControllerOptionsPanel(
		{} as IFramePoolManager,
		client,
		close,
	);
	panel.onMount({} as IUIComponent);
	expect(state.rows.some((row) => row.label === "Movement")).toBe(true);
	const radios = () =>
		state.rows.filter((row) => row.id.startsWith("choice-travelStyle"));
	expect(radios()).toHaveLength(3);
	expect(radios().every((row) => row.radio)).toBe(true);
	expect(
		radios().every(
			(row) => row.fontSize === 20 && row.group?.id === "travelStyle",
		),
	).toBe(true);
	expect(
		state.rows
			.filter((row) => row.heading)
			.every((row) => row.fontSize === 27 && row.detailFontSize === 15),
	).toBe(true);
	expect(state.listOptions).toMatchObject({ titleFontSize: 18 });
	expect(
		radios()
			.filter((row) => row.checked)
			.map((row) => row.label),
	).toEqual(["Face movement stick"]);
	state.rows.find((row) => row.id === "choice-travelStyle-mixed")?.activate();
	expect(client.set).toHaveBeenLastCalledWith("travelStyle", "mixed");
	expect(
		radios()
			.filter((row) => row.checked)
			.map((row) => row.label),
	).toEqual(["Strafe, then face stick"]);
	const slider = state.rows.find((row) => row.id === "option-yawSpeed");
	expect(slider?.fullWidth).toBe(true);
	expect(slider?.fontSize).toBe(21.25);
	expect(slider?.background).toBe(false);
	expect(
		state.rows.find((row) => row.id === "option-pitchSpeed")?.fullWidth,
	).toBe(true);
	expect(slider?.slider).toMatchObject({
		minimum: 0.5,
		maximum: 1.25,
		step: 0.25,
		value: 1,
	});
	slider?.slider?.change(1.25);
	expect(client.set).toHaveBeenLastCalledWith("yawSpeed", "1.25");
	expect(
		state.rows.find((row) => row.id === "option-yawSpeed")?.slider?.value,
	).toBe(1.25);
	expect(
		state.rows.find((row) => row.id === "option-pitchSpeed")?.enabled,
	).toBe(false);
	expect(
		state.rows.some(
			(row) => row.id === "options-reset" || row.id === "options-close",
		),
	).toBe(false);
	expect(
		state.frames.get("controller-options-reset")?.setColor,
	).toHaveBeenCalledWith(0.5, 0.08, 0.08);
	expect(
		state.frames.get("controller-options-reset")?.layout,
	).toHaveBeenCalledWith(280, 44, "TOPRIGHT", expect.anything(), -24, -36);
	expect(
		state.frames.get("controller-options-reset")?.setLabel,
	).toHaveBeenCalledWith(
		"label",
		"Reset controller defaults",
		"CENTER",
		0,
		0,
		17.5,
	);
	panel.getNavGrid().at(0)?.at(0)?.onInteract();
	expect(client.reset).toHaveBeenCalledOnce();
	expect(close).not.toHaveBeenCalled();
	panel.destroy();
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
