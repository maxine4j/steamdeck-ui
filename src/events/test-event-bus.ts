import { vi } from "vitest";
import { WowEventBus } from "./wow-event-bus";

export function createTestEventBus(): WowEventBus {
	return new WowEventBus({
		createEventFrame: () => ({
			Hide: vi.fn(),
			Show: vi.fn(),
			SetParent: vi.fn(),
			ClearAllPoints: vi.fn(),
			SetPoint: vi.fn(),
			SetSize: vi.fn(),
			CreateTexture: vi.fn(),
			RegisterEvent: vi.fn(),
			SetScript: vi.fn(),
		}),
	});
}
