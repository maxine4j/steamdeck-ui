import { expect, it, vi } from "vitest";
import { Diagnostics } from "../../clients/diagnostics";
import type { Frame } from "../../ui/components/frame";
import type { ListRow } from "../../ui/components/scroll-list";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { CachePerformancePanel } from "./cache-performance-panel";
import { DebugErrorsPanel } from "./debug-errors-panel";
import { DebugLogsPanel } from "./debug-logs-panel";

const { frames, rows, insets } = vi.hoisted(() => ({
	insets: vi.fn(),
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
		inset = insets;
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
		updateRows(value: readonly ListRow[]) {
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
	expect(insets).toHaveBeenCalledWith(expect.anything(), 12, 110, 8, 12);
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

it("loads errors on opening, separates seen from new chronologically, opens full details and returns without marking again", () => {
	const errors = [
		{ id: 1, timestamp: 100, message: "old bug", stack: "old stack" },
		{
			id: 2,
			timestamp: 101,
			message: "new bug\nsecond line",
			stack: "complete stack\naddon.lua:42",
		},
	];
	const loadErrors = vi.fn(() => ({
		errors,
		isNew: (error: { id: number }) => error.id === 2,
	}));
	const changed = vi.fn();
	const close = vi.fn();
	const panel = new DebugErrorsPanel(
		{} as IFramePoolManager,
		{ loadErrors },
		close,
	);
	panel.setNavigationChanged(changed);
	panel.onMount({} as Frame);
	const rendered = rows.get("debug-errors-list") ?? [];
	expect(rendered.map((row) => row.id)).toEqual([
		"error-1",
		"errors-new-divider",
		"error-2",
	]);
	expect(rendered.at(1)).toMatchObject({
		heading: true,
		label: expect.stringContaining("|cffff3333"),
	});
	expect(rendered.at(2)?.label).toContain("new bug");
	rendered.at(2)?.activate();
	expect(frames.get("debug-error-detail-text")?.text).toContain(
		"complete stack\naddon.lua:42",
	);
	expect(frames.get("debug-error-detail-text")?.text).toContain(
		"new bug\nsecond line",
	);
	expect(frames.get("debug-error-detail-text")?.text).toContain("101");
	panel.getNavGrid().at(0)?.at(1)?.onInteract();
	expect(frames.get("debug-error-detail-text")?.selected).toBe(true);
	panel.onBack();
	expect(loadErrors).toHaveBeenCalledOnce();
	expect(changed).toHaveBeenCalled();
	panel.onBack();
	expect(close).toHaveBeenCalledOnce();
	panel.onUnmount();
	panel.onMount({} as Frame);
	expect(loadErrors).toHaveBeenCalledTimes(2);
	panel.destroy();
});

it("shows an empty error history and places the new boundary after all seen errors", () => {
	const loadErrors = vi.fn(() => ({
		errors: [] as {
			id: number;
			timestamp: number;
			message: string;
			stack: string;
		}[],
		isNew: () => false,
	}));
	const panel = new DebugErrorsPanel(
		{} as IFramePoolManager,
		{ loadErrors },
		vi.fn(),
	);
	panel.onMount({} as Frame);
	expect(rows.get("debug-errors-list")?.at(0)?.label).toContain(
		"No Lua errors",
	);
	panel.onUnmount();
	loadErrors.mockReturnValue({
		errors: [{ id: 1, timestamp: 100, message: "seen", stack: "stack" }],
		isNew: () => false,
	});
	panel.onMount({} as Frame);
	expect(rows.get("debug-errors-list")?.map((row) => row.id)).toEqual([
		"error-1",
		"errors-new-divider",
	]);
});
