import { expect, it, vi } from "vitest";
import type { Frame } from "./components/frame";
import { PanelContainer } from "./panel/panel-container";
import { UIOrchestrator } from "./ui-orchestrator";

function createPanel(id: string) {
	return {
		id,
		title: id,
		onMount: vi.fn(),
		onUnmount: vi.fn(),
		onContainerClosed: vi.fn(),
		getNavGrid: () => [],
	};
}

function createUI(trace?: (message: string) => void) {
	return new UIOrchestrator(
		(position, id = position) =>
			new PanelContainer(id, position, {
				dock: vi.fn(),
				onClose: vi.fn(),
				show: vi.fn(),
				hide: vi.fn(),
			} as unknown as Frame),
		trace,
	);
}

it("records panel and container before lifecycle code can fail", () => {
	const trace = vi.fn();
	const ui = createUI(trace);
	const panel = createPanel("broken");
	panel.onMount.mockImplementation(() => {
		expect(trace).toHaveBeenLastCalledWith(
			"panel open id=broken position=left container=feature",
		);
		throw new Error("mount failed");
	});
	ui.registerPanel(panel);
	expect(() => ui.openPanel("broken", "left", "feature")).toThrow(
		"mount failed",
	);
	ui.closePanel("left", undefined, "feature");
	expect(trace).toHaveBeenLastCalledWith(
		"panel close id=active position=left container=feature",
	);
});

it.each(["left", "right"] as const)(
	"opening a %s panel closes the entire fullscreen stack before mounting",
	(position) => {
		const ui = createUI();
		const map = createPanel("map");
		const talents = createPanel("talents");
		const side = createPanel("side");
		ui.registerPanel(map);
		ui.registerPanel(side);
		ui.openPanel(map.id, "fullscreen", "editor");
		const fullscreen = ui.getContainer("fullscreen", "editor");
		fullscreen.pushPanel(talents);
		side.onMount.mockImplementation(() => {
			expect(fullscreen.activePanelId).toBeUndefined();
		});

		ui.openPanel(side.id, position);

		expect(ui.getContainer(position).activePanelId).toBe(side.id);
		expect(fullscreen.activePanelId).toBeUndefined();
		expect(talents.onUnmount).toHaveBeenCalledOnce();
		expect(map.onContainerClosed).toHaveBeenCalledOnce();
		ui.closePanel(position);
		expect(fullscreen.activePanelId).toBeUndefined();
	},
);

it.each([["left"], ["right"], ["left", "right"]] as const)(
	"opening fullscreen closes side panels at %j",
	(...positions) => {
		const ui = createUI();
		const fullscreen = createPanel("map");
		ui.registerPanel(fullscreen);
		const panels = positions.map((position) => {
			const panel = createPanel(position);
			ui.registerPanel(panel);
			ui.openPanel(panel.id, position, `${position}-feature`);
			return panel;
		});
		fullscreen.onMount.mockImplementation(() => {
			for (const position of positions)
				expect(
					ui.getContainer(position, `${position}-feature`).activePanelId,
				).toBeUndefined();
		});

		ui.openPanel(fullscreen.id, "fullscreen");

		expect(ui.getContainer("fullscreen").activePanelId).toBe(fullscreen.id);
		for (const panel of panels) {
			expect(panel.onUnmount).toHaveBeenCalledOnce();
			expect(panel.onContainerClosed).toHaveBeenCalledOnce();
		}
		ui.closePanel("fullscreen");
		for (const position of positions)
			expect(
				ui.getContainer(position, `${position}-feature`).activePanelId,
			).toBeUndefined();
	},
);

it("opening fullscreen drains both docked stacks before mounting its panel", () => {
	const order: string[] = [];
	const ui = new UIOrchestrator((position) => {
		const stack = position === "fullscreen" ? [] : ["base", "overlay"];
		return {
			position,
			get activePanelId() {
				return stack.at(-1);
			},
			popPanel: () => {
				order.push(`${position}:${stack.pop()}`);
			},
			swapPanel: () => {
				order.push("fullscreen:mount");
			},
		} as unknown as PanelContainer;
	});
	ui.registerPanel({
		id: "achievements",
		title: "Achievements",
		onMount: vi.fn(),
		onUnmount: vi.fn(),
		getNavGrid: () => [],
	});
	ui.openPanel("achievements", "fullscreen");
	expect(order).toEqual([
		"left:overlay",
		"left:base",
		"right:overlay",
		"right:base",
		"fullscreen:mount",
	]);
});

it("hosts dedicated containers exclusively at a dock without mixing their tabs", () => {
	const containers = new Map<
		string,
		{
			swapPanel: ReturnType<typeof vi.fn>;
			popPanel: ReturnType<typeof vi.fn>;
			registerPanel: ReturnType<typeof vi.fn>;
			activePanelId?: string;
			position: string;
		}
	>();
	const ui = new UIOrchestrator((position, id = position) => {
		const container = {
			position,
			activePanelId: undefined as string | undefined,
			registerPanel: vi.fn(),
			swapPanel: vi.fn((panel: { id: string }) => {
				container.activePanelId = panel.id;
			}),
			popPanel: vi.fn(() => {
				container.activePanelId = undefined;
			}),
		};
		containers.set(id, container);
		return container as unknown as PanelContainer;
	});
	const panel = (id: string) => ({
		id,
		title: id,
		onMount: vi.fn(),
		onUnmount: vi.fn(),
		getNavGrid: () => [],
	});
	ui.registerPanel(panel("character"), "left");
	ui.registerPanel(panel("vendor"), "left", "merchant");
	ui.registerPanel(panel("buyback"), "left", "merchant");
	ui.openPanel("character", "left");
	ui.openPanel("vendor", "left", "merchant");
	expect(containers.get("left")?.popPanel).toHaveBeenCalledOnce();
	expect(containers.get("merchant")?.registerPanel).toHaveBeenCalledTimes(2);
	ui.openPanel("buyback", "left", "merchant");
	expect(containers.get("merchant")?.popPanel).not.toHaveBeenCalled();
	ui.openPanel("character", "left");
	expect(containers.get("merchant")?.popPanel).toHaveBeenCalledOnce();
});
