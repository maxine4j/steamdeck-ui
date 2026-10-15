import type { Diagnostics } from "../../clients/diagnostics";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import { Frame } from "../../ui/components/frame";
import type { IUIComponent } from "../../ui/components/types";
import { setWindowTitle } from "../../ui/components/window-title";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { IPanel } from "../../ui/panel/types";

export class DebugLogsPanel implements IPanel {
	readonly id = "debug-logs";
	readonly title = "Logs";
	readonly icon = 134332;
	private readonly window: Frame;
	private readonly scroll: Frame;
	private readonly text: Frame;
	private readonly select: Frame;
	private readonly closeButton: Frame;
	private detach?: () => void;
	private cancelRefresh?: () => void;
	private copying = false;
	private mounted = false;
	constructor(
		pool: IFramePoolManager,
		private readonly diagnostics: Diagnostics,
		private readonly details: () => string,
		private readonly close: () => void,
		private readonly scheduler: Pick<ITaskScheduler, "delay">,
	) {
		this.window = new Frame("debug-logs-window", pool);
		this.scroll = new Frame("debug-logs-scroll", pool, "ScrollFrame");
		this.text = new Frame("debug-log-text", pool, "EditBox");
		this.select = new Frame("debug-select-logs", pool, "Button");
		this.closeButton = new Frame("debug-logs-close", pool, "Button");
		this.closeButton.onClick(close);
	}
	private readonly selectAll = () => {
		this.refresh();
		this.copying = true;
		this.text.selectInputText();
		this.status();
	};
	private status(): void {
		this.window.setLabel(
			"status",
			this.copying
				? "Snapshot selected. Press Ctrl+C to copy."
				: "Live session log · select all to copy a report",
			"TOPLEFT",
			16,
			-86,
			13,
			460,
		);
	}
	private refresh(): void {
		const jobs = this.diagnostics
			.jobs()
			.map(
				(job) =>
					`${job.label}: ${job.state} ${job.completed}/${job.total} reason=${job.reason} elapsed=${job.elapsed.toFixed(2)}ms`,
			)
			.join("\n");
		this.text.setInputText(
			`SteamDeckUI diagnostics · ${this.diagnostics.now()}\n${this.details()}\n\nWork\n${jobs || "No work recorded"}\n\nLogs\n${this.diagnostics.report() || "No logs recorded"}`,
		);
	}
	onMount(parent: IUIComponent): void {
		this.mounted = true;
		this.copying = false;
		this.window.fill(parent as Frame);
		this.window.setWindowBackground();
		setWindowTitle(this.window, "SteamDeckUI · Logs");
		this.select.setParent(this.window);
		this.select.layout(300, 32, "TOPLEFT", this.window, 16, -42);
		this.select.setButtonBackground();
		this.select.setLabel(
			"label",
			"Select all logs (Ctrl+C)",
			"CENTER",
			0,
			0,
			14,
		);
		this.select.onClick(this.selectAll);
		this.closeButton.setParent(this.window);
		this.closeButton.layout(24, 24, "TOPRIGHT", this.window, -2, -2);
		this.closeButton.setCloseButtonBackground();
		this.scroll.inset(this.window, 12, 110, 12, 12);
		this.text.setParent(this.scroll);
		this.scroll.setScrollContent(this.text);
		this.text.configureTextInput(() => {}, true, 0, this.scroll);
		this.layout();
		this.window.onSizeChanged(() => this.layout());
		this.status();
		this.refresh();
		this.text.blurInput();
		this.detach = this.diagnostics.subscribe((kind) => {
			if (kind !== "log" || this.copying || this.cancelRefresh) return;
			this.cancelRefresh = this.scheduler.delay(0.2, () => {
				this.cancelRefresh = undefined;
				if (this.mounted && !this.copying) this.refresh();
			});
		});
		for (const frame of [
			this.window,
			this.scroll,
			this.text,
			this.select,
			this.closeButton,
		])
			frame.show();
	}
	private layout(): void {
		const size = this.window.getSize();
		// Multiline EditBox grows with its text; its width controls native wrapping.
		this.text.layout(
			Math.max(1, size.width - 32),
			Math.max(1, size.height - 130),
			"TOPLEFT",
			this.scroll,
		);
		this.scroll.clampScroll();
	}
	onUnmount(): void {
		this.mounted = false;
		this.detach?.();
		this.detach = undefined;
		this.cancelRefresh?.();
		this.cancelRefresh = undefined;
		this.window.onSizeChanged();
		this.text.blurInput();
		this.window.hide();
	}
	getNavGrid() {
		return this.mounted
			? [
					[
						this.select.navigationNode(this.select.id, this.selectAll),
						this.closeButton.navigationNode(this.closeButton.id, this.close),
					],
				]
			: [];
	}
	onBack(): void {
		this.close();
	}
	destroy(): void {
		this.onUnmount();
		for (const frame of [
			this.text,
			this.scroll,
			this.select,
			this.closeButton,
			this.window,
		])
			frame.destroy();
	}
}
