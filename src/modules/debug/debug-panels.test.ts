import { expect, it, vi } from "vitest";
import { Diagnostics } from "../../clients/diagnostics";
import type { Frame } from "../../ui/components/frame";
import type { ListRow } from "../../ui/components/scroll-list";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { CachePerformancePanel } from "./cache-performance-panel";
import { DebugLogsPanel } from "./debug-logs-panel";

const { frames, rows } = vi.hoisted(() => ({
	frames: new Map<
		string,
		{ text: string; selected: boolean; click?: () => void }
	>(),
	rows: new Map<string, readonly ListRow[]>(),
}));
vi.mock("../../ui/components/frame", () => ({
	Frame: class {
		state = {
			text: "",
			selected: false,
			click: undefined as (() => void) | undefined,
		};
		constructor(readonly id: string) {
			frames.set(id, this.state);
		}
		fill() {}
		inset() {}
		setParent() {}
		layout() {}
		setWindowBackground() {}
		setButtonBackground() {}
		setCloseButtonBackground() {}
		setInsetBackground() {}
		setLabel() {}
		setScrollContent() {}
		configureTextInput() {}
		show() {}
		hide() {}
		blurInput() {}
		destroy() {}
		onSizeChanged() {}
		resetScroll() {}
		clampScroll() {}
		getSize() {
			return { width: 500, height: 800 };
		}
		onClick(click: () => void) {
			this.state.click = click;
		}
		setInputText(text: string) {
			this.state.text = text;
		}
		selectInputText() {
			this.state.selected = true;
		}
		navigationNode(navId: string, onInteract: () => void) {
			return { navId, onInteract, onFocus() {}, onBlur() {} };
		}
	},
}));
vi.mock("../../ui/components/scroll-list", () => ({
	ScrollList: class {
		constructor(readonly id: string) {}
		setRows(value: readonly ListRow[]) {
			rows.set(this.id, value);
		}
		mount() {}
		unmount() {}
		destroy() {}
		getNavGrid() {
			return [];
		}
	},
}));

it("selects a fresh full report on mouse or controller activation and preserves selection while logs arrive", () => {
	const diagnostics = new Diagnostics(() => 100);
	diagnostics.log("error", "traceback");
	const panel = new DebugLogsPanel(
		{} as IFramePoolManager,
		diagnostics,
		() => "mounts: 42 records",
		vi.fn(),
		{ delay: vi.fn() },
	);
	panel.onMount({} as Frame);
	frames.get("debug-select-logs")?.click?.();
	expect(frames.get("debug-log-text")?.selected).toBe(true);
	expect(frames.get("debug-log-text")?.text).toContain("traceback");
	expect(frames.get("debug-log-text")?.text).toContain("mounts: 42 records");
	const snapshot = frames.get("debug-log-text")?.text;
	diagnostics.log("info", "arrived during copy");
	expect(frames.get("debug-log-text")?.text).toBe(snapshot);
	panel.getNavGrid().at(0)?.at(0)?.onInteract();
	expect(frames.get("debug-log-text")?.text).toContain("arrived during copy");
	panel.onUnmount();
});

it("defers and coalesces live log rendering outside the Lua error handler and cancels it when hidden", () => {
	const diagnostics = new Diagnostics(() => 100);
	const pending: (() => void)[] = [];
	const cancelled = vi.fn();
	const panel = new DebugLogsPanel(
		{} as IFramePoolManager,
		diagnostics,
		() => "",
		vi.fn(),
		{
			delay: (_seconds, callback) => {
				pending.push(callback);
				return cancelled;
			},
		},
	);
	panel.onMount({} as Frame);
	diagnostics.log("error", "deferred error");
	diagnostics.log("info", "another log");
	expect(frames.get("debug-log-text")?.text).not.toContain("deferred error");
	expect(pending).toHaveLength(1);
	pending.shift()?.();
	expect(frames.get("debug-log-text")?.text).toContain("deferred error");
	diagnostics.log("info", "cancel me");
	panel.onUnmount();
	expect(cancelled).toHaveBeenCalledOnce();
});

it("shows scan reasons, progress, retained cache size/age and pending work; polls only while mounted", () => {
	const diagnostics = new Diagnostics(() => 120);
	diagnostics.work({
		id: 1,
		label: "mounts scan",
		reason: "login",
		completed: 20,
		total: 40,
		elapsed: 5,
		state: "running",
	});
	const pending: (() => void)[] = [];
	const cancelled = vi.fn();
	const scheduler = {
		delay: (_seconds: number, callback: () => void) => {
			pending.push(callback);
			return cancelled;
		},
	};
	const panel = new CachePerformancePanel(
		{} as IFramePoolManager,
		diagnostics,
		() => [{ namespace: "mounts", entries: 20, pending: 3, updatedAt: 100 }],
		scheduler,
		vi.fn(),
	);
	panel.onMount({} as Frame);
	const rendered = rows.get("debug-cache-list") ?? [];
	expect(rendered.find((row) => row.id === "work-1")).toMatchObject({
		detail: expect.stringContaining("login"),
		progress: { value: 0.5 },
	});
	expect(rendered.find((row) => row.id === "cache-mounts")?.detail).toContain(
		"20s",
	);
	expect(rendered.find((row) => row.id === "cache-mounts")?.label).toContain(
		"20",
	);
	expect(rendered.find((row) => row.id === "cache-mounts")?.detail).toContain(
		"3 queued",
	);
	expect(pending).toHaveLength(1);
	panel.onUnmount();
	expect(cancelled).toHaveBeenCalledOnce();
	pending.shift()?.();
	expect(pending).toHaveLength(0);
});
