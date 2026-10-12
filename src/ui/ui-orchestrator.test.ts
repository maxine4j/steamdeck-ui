import { expect, it, vi } from "vitest";
import type { PanelContainer } from "./panel/panel-container";
import { UIOrchestrator } from "./ui-orchestrator";

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
