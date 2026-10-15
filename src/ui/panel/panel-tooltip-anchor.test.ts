import { expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import type { Frame } from "../components/frame";
import { NavigationManager } from "../navigation/navigation-manager";
import { PanelContainer } from "./panel-container";

it("publishes the actual container and dock when controller focus changes sides", () => {
	const navigation = new NavigationManager(createTestEventBus());
	const focused = vi.fn();
	const frames = ["left", "right"].map(
		() =>
			({
				dock: vi.fn(),
				onClose: vi.fn(),
				show: vi.fn(),
				hide: vi.fn(),
				setFocusBorder: vi.fn(),
			}) as unknown as Frame,
	);
	const containers = (["left", "right"] as const).map((side, index) => {
		const container = new PanelContainer(
			side,
			side,
			frames.at(index) as Frame,
			undefined,
			undefined,
			navigation,
			undefined,
			[],
			undefined,
			focused,
		);
		container.pushPanel({
			id: side,
			title: side,
			onMount: vi.fn(),
			onUnmount: vi.fn(),
			getNavGrid: () => [
				[
					{
						navId: side,
						onFocus: vi.fn(),
						onBlur: vi.fn(),
						onInteract: vi.fn(),
					},
				],
			],
		});
		return container;
	});
	expect(focused).toHaveBeenLastCalledWith(frames.at(1), "right");
	containers.at(0)?.focus();
	expect(focused).toHaveBeenLastCalledWith(frames.at(0), "left");
});
