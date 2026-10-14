import type { ITaskScheduler } from "../../clients/task-scheduler";
import type { IFramePoolManager } from "../frame-pool-manager";
import type { NavGrid } from "../navigation/types";
import { DebouncedInput } from "./debounced-input";
import type { DropdownOption } from "./dropdown";
import { Dropdown } from "./dropdown";
import { Frame } from "./frame";

export class SearchFilters {
	private readonly search: Frame;
	private readonly filters: Dropdown;
	private readonly input: DebouncedInput;
	private mounted = false;
	private readonly grid: NavGrid;
	constructor(
		id: string,
		pool: IFramePoolManager,
		private readonly searchChanged: (text: string) => void,
		scheduler: ITaskScheduler,
		navigationChanged?: (focusId?: string) => void,
	) {
		this.search = new Frame(`${id}-search`, pool, "SearchBox");
		this.filters = new Dropdown(`${id}-filters`, pool, navigationChanged);
		this.input = new DebouncedInput(scheduler, (text) => {
			if (this.mounted) this.searchChanged(text);
		});
		this.grid = [
			[
				{
					navId: this.search.id,
					onFocus: (refresh) => this.search.setFocused(true, false, refresh),
					onBlur: () => {
						this.search.setFocused(false);
						this.search.blurInput();
					},
					onInteract: () => {
						if (this.mounted) this.search.focusInput();
					},
				},
			],
		];
	}
	mount(parent: Frame): void {
		this.mounted = true;
		this.search.setParent(parent);
		this.search.layout(300, 20, "TOPLEFT", parent, 16, -66);
		this.search.configureInput((text) => {
			if (this.mounted) this.input.change(text);
		});
		this.search.blurInput();
		this.search.show();
		this.filters.mount(parent);
		this.input.resume();
	}
	getNavGrid(): NavGrid {
		return this.mounted ? [...this.grid, ...this.filters.getNavGrid()] : [];
	}
	setOptions(options: DropdownOption[]): void {
		this.filters.setOptions(options);
	}
	isOpen(): boolean {
		return this.filters.isOpen();
	}
	hide(): void {
		this.mounted = false;
		this.input.cancel();
		this.search.blurInput();
		this.filters.hide();
	}
	destroy(): void {
		this.hide();
		this.filters.destroy();
		this.search.destroy();
	}
}
