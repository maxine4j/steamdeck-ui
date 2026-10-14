import { expect, it, vi } from "vitest";
import type { IMailClient } from "../../clients/mail-client";
import { createTestEventBus } from "../../events/test-event-bus";
import type { IModalNavigation } from "../../ui/components/modal";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { IPanel } from "../../ui/panel/types";
import { registerMail } from "./register-mail";

it("registers only Inbox and Send Mail in the dedicated left mailbox container", () => {
	const panels: IPanel[] = [];
	const ui = {
		registerPanel: vi.fn((panel: IPanel) => panels.push(panel)),
		openPanel: vi.fn(),
		closePanel: vi.fn(),
	};
	const modules = { register: vi.fn() };
	const feature = registerMail(
		{} as IFramePoolManager,
		{} as IModalNavigation,
		createTestEventBus(),
		ui,
		modules,
		{} as IMailClient,
		{ nextFrame: vi.fn(), delay: vi.fn() },
	);
	expect(ui.registerPanel.mock.calls.map(([panel]) => panel.id)).toEqual([
		"mail-inbox",
		"mail-send",
	]);
	expect(ui.registerPanel).toHaveBeenCalledWith(panels.at(0), "left", "mail");
	expect(ui.registerPanel).toHaveBeenCalledWith(panels.at(1), "left", "mail");
	expect(modules.register).toHaveBeenCalledWith(
		expect.objectContaining({ id: "mail" }),
	);
	expect(feature.destroy).toBeTypeOf("function");
});
