import type { DebugClient } from "../../clients/debug-client";
import type { LuaErrorRecord } from "../../clients/lua-error-history";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import { Frame } from "../../ui/components/frame";
import { SCROLL_VIEWPORT_RIGHT } from "../../ui/components/scroll-indicator";
import { type ListRow, ScrollList } from "../../ui/components/scroll-list";
import type { IUIComponent } from "../../ui/components/types";
import { setWindowTitle } from "../../ui/components/window-title";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { IPanel } from "../../ui/panel/types";

export class DebugErrorsPanel implements IPanel {
	readonly id = "debug-errors";
	readonly title = "Errors";
	readonly icon = 132284;
	private readonly list: ScrollList;
	private readonly window: Frame;
	private readonly scroll: Frame;
	private readonly text: Frame;
	private readonly back: Frame;
	private readonly select: Frame;
	private parent?: IUIComponent;
	private selected?: LuaErrorRecord;
	private changed?: (focusId?: string) => void;
	constructor(
		pool: IFramePoolManager,
		private readonly client: Pick<DebugClient, "loadErrors">,
		private readonly close: () => void,
		scheduler: ITaskScheduler,
	) {
		this.list = new ScrollList(
			"debug-errors-list",
			pool,
			"Lua errors · oldest first",
			close,
			{
				padding: 16,
				preserveScrollOnRefresh: true,
				scheduler,
				batchSize: 10,
				onChanged: () => this.changed?.(),
			},
		);
		this.window = new Frame("debug-error-detail-window", pool);
		this.scroll = new Frame("debug-error-detail-scroll", pool, "ScrollFrame");
		this.text = new Frame("debug-error-detail-text", pool, "EditBox");
		this.back = new Frame("debug-error-back", pool, "Button");
		this.select = new Frame("debug-error-select", pool, "Button");
		this.back.onClick(() => this.onBack());
		this.select.onClick(() => this.text.selectInputText());
	}
	onMount(parent: IUIComponent): void {
		this.parent = parent;
		this.selected = undefined;
		const snapshot = this.client.loadErrors();
		const rows: ListRow[] = [];
		if (snapshot.suppressedCount)
			rows.push({
				id: "errors-flood",
				label: `|cffff3333Error flood: ${snapshot.suppressedCount} additional errors suppressed|r`,
				heading: true,
				activate: () => {},
			});
		const divider: ListRow = {
			id: "errors-new-divider",
			label: "|cffff3333──────── New since last view ────────|r",
			heading: true,
			activate: () => {},
		};
		let divided = false;
		for (const error of snapshot.errors) {
			if (!divided && snapshot.isNew(error)) {
				rows.push(divider);
				divided = true;
			}
			rows.push({
				id: `error-${error.id}`,
				label: (error.message.split("\n").at(0) ?? "Lua error")
					.split("|")
					.join("||"),
				detail: `#${error.id} · Unix time ${error.timestamp} · ${snapshot.isNew(error) ? "New" : "Seen"}`,
				height: 64,
				activate: () => this.showDetails(error),
			});
		}
		if (snapshot.errors.length === 0)
			rows.push({
				id: "errors-empty",
				label: "No Lua errors captured",
				heading: true,
				activate: () => {},
			});
		else if (!divided) rows.push(divider);
		this.list.setRows(rows);
		this.list.mount(parent);
	}
	private showDetails(error: LuaErrorRecord): void {
		if (!this.parent) return;
		this.selected = error;
		this.list.unmount();
		this.window.fill(this.parent as Frame);
		this.window.setWindowBackground();
		setWindowTitle(this.window, `Lua error #${error.id}`);
		this.back.setParent(this.window);
		this.back.layout(120, 32, "TOPLEFT", this.window, 16, -42);
		this.back.setButtonBackground();
		this.back.setLabel("label", "Back to errors", "CENTER", 0, 0, 14);
		this.select.setParent(this.window);
		this.select.layout(240, 32, "TOPLEFT", this.window, 148, -42);
		this.select.setButtonBackground();
		this.select.setLabel(
			"label",
			"Select details (Ctrl+C)",
			"CENTER",
			0,
			0,
			14,
		);
		this.scroll.inset(this.window, 12, 86, SCROLL_VIEWPORT_RIGHT, 12);
		this.text.setParent(this.scroll);
		this.scroll.setScrollContent(this.text);
		this.text.configureTextInput(() => {}, true, 0, this.scroll);
		this.layout();
		this.window.onSizeChanged(() => this.layout());
		this.text.setInputText(
			`Lua error #${error.id}\nTimestamp (Unix): ${error.timestamp}\n\n${error.message}\n\nStack trace\n${error.stack}`,
		);
		this.text.blurInput();
		this.scroll.resetScroll();
		for (const frame of [
			this.window,
			this.scroll,
			this.text,
			this.back,
			this.select,
		])
			frame.show();
		this.changed?.();
	}
	private layout(): void {
		const size = this.window.getSize();
		this.text.layout(
			Math.max(1, size.width - 32),
			Math.max(1, size.height - 110),
			"TOPLEFT",
			this.scroll,
		);
		this.scroll.clampScroll();
	}
	private hideDetails(): void {
		this.text.blurInput();
		this.window.onSizeChanged();
		this.window.hide();
	}
	onUnmount(): void {
		this.parent = undefined;
		this.selected = undefined;
		this.list.unmount();
		this.hideDetails();
	}
	setNavigationChanged(changed?: (focusId?: string) => void): void {
		this.changed = changed;
	}
	getNavGrid() {
		if (!this.parent) return [];
		return this.selected
			? [
					[
						this.back.navigationNode(this.back.id, () => this.onBack()),
						this.select.navigationNode(this.select.id, () =>
							this.text.selectInputText(),
						),
					],
				]
			: this.list.getNavGrid();
	}
	onBack(): void {
		if (!this.selected || !this.parent) {
			this.close();
			return;
		}
		const focus = `error-${this.selected.id}`;
		this.selected = undefined;
		this.hideDetails();
		this.list.mount(this.parent);
		this.changed?.(focus);
	}
	destroy(): void {
		this.onUnmount();
		this.list.destroy();
		for (const frame of [
			this.text,
			this.scroll,
			this.back,
			this.select,
			this.window,
		])
			frame.destroy();
	}
}
