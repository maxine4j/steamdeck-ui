import { expect, it, vi } from "vitest";
import type { Frame } from "../components/frame";
import { PanelContainer } from "./panel-container";

it("keeps registered tabs, mounts only the selection and closes without remounting siblings", () => {
	const frame = {
		dock: vi.fn(),
		show: vi.fn(),
		hide: vi.fn(),
		destroy: vi.fn(),
	} as unknown as Frame;
	const buttons: {
		onClick: ReturnType<typeof vi.fn>;
		layout: ReturnType<typeof vi.fn>;
		hide: ReturnType<typeof vi.fn>;
	}[] = [];
	const container = new PanelContainer(
		"left",
		"left",
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
	buttons.at(1)?.onClick.mock.calls.at(-1)?.at(0)("LeftButton");
	expect(first.onUnmount).toHaveBeenCalledOnce();
	expect(second.onMount).toHaveBeenCalledOnce();
	container.swapPanel(second);
	expect(second.onMount).toHaveBeenCalledOnce();
	expect(buttons.at(0)?.layout).toHaveBeenCalledWith(
		40,
		40,
		"RIGHT",
		frame,
		48,
		24,
	);
	expect(buttons.at(1)?.layout).toHaveBeenCalledWith(
		40,
		40,
		"RIGHT",
		frame,
		48,
		-24,
	);
	container.popPanel();
	expect(first.onMount).toHaveBeenCalledOnce();
	expect(second.onUnmount).toHaveBeenCalledOnce();
	expect(frame.hide).toHaveBeenCalled();
	container.swapPanel(first);
	expect(buttons).toHaveLength(2);
	container.clear();
});
