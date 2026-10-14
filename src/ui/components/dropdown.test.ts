import { afterEach, expect, it, vi } from "vitest";
import type { IFramePoolManager } from "../frame-pool-manager";
import { Dropdown } from "./dropdown";
import { Frame } from "./frame";

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

it("preserves Blizzard's intrinsic hover scripts when returning a dropdown to the pool", () => {
	const native = { SetScript: vi.fn() };
	const pool = {
		acquire: () => native,
		getBackground: () => ({ SetColorTexture: vi.fn() }),
		release: vi.fn(),
	} as unknown as IFramePoolManager;
	const button = new Frame("filters", pool, "FilterDropdown");
	button.getDropdownButton();
	button.destroy();
	expect(pool.release).toHaveBeenCalledWith("FilterDropdown", native);
	expect(native.SetScript).not.toHaveBeenCalledWith("OnEnter", undefined);
	expect(native.SetScript).not.toHaveBeenCalledWith("OnLeave", undefined);
});

function setup() {
	for (const method of [
		"setParent",
		"layout",
		"setButtonBackground",
		"setLabel",
		"onClick",
		"show",
		"hide",
		"setFocused",
		"destroy",
	] as const)
		vi.spyOn(Frame.prototype, method).mockImplementation(() => {});
	vi.stubGlobal("MenuResponse", { Refresh: 2, Close: 3 });
	vi.stubGlobal("MenuInputContext", { None: 1 });
	const callbacks = new Map<string, () => void>();
	let open = false;
	const entries: {
		label: string;
		checked?: () => boolean;
		pick: () => void;
		enter: ReturnType<typeof vi.fn>;
		leave: ReturnType<typeof vi.fn>;
	}[] = [];
	const create = (
		label: string,
		checked: (() => boolean) | undefined,
		respond: () => number,
	) => {
		const entry = {
			label,
			checked,
			enter: vi.fn(),
			leave: vi.fn(),
			pick: () => {
				if (respond() === 3) native.CloseMenu();
			},
		};
		entries.push(entry);
		return {
			AddInitializer: (initialize: (frame: object) => void) => initialize({}),
			HandleOnEnter: entry.enter,
			HandleOnLeave: entry.leave,
			Pick: entry.pick,
		};
	};
	const root = {
		CreateCheckbox: (
			label: string,
			checked: () => boolean,
			respond: () => number,
		) => create(label, checked, respond),
		CreateRadio: (
			label: string,
			checked: () => boolean,
			respond: () => number,
		) => create(label, checked, respond),
		CreateButton: (label: string, respond: () => number) =>
			create(label, undefined, respond),
	};
	const native = {
		SetupMenu: vi.fn((generate: (button: object, root: object) => void) => {
			entries.length = 0;
			generate(native, root);
		}),
		RegisterCallback: (event: string, callback: () => void) =>
			callbacks.set(event, callback),
		UnregisterCallback: vi.fn(),
		IsMenuOpen: () => open,
		SetMenuOpen: (value: boolean) => {
			open = value;
			callbacks.get(value ? "OnMenuOpen" : "OnMenuClose")?.();
		},
		CloseMenu: () => {
			if (open) {
				open = false;
				callbacks.get("OnMenuClose")?.();
			}
		},
		ClearMenuState: vi.fn(),
	};
	const pool = {
		acquire: vi.fn(() => native),
		getBackground: vi.fn(() => ({})),
	} as unknown as IFramePoolManager;
	const changed = vi.fn();
	const dropdown = new Dropdown("filters", pool, changed);
	dropdown.mount(new Frame("parent", pool));
	return { dropdown, native, pool, entries, changed };
}

it("uses Blizzard's dropdown and exposes native checkbox focus and activation to navigation", () => {
	const { dropdown, pool, entries, changed } = setup();
	let checked = false;
	const options = () => [
		{
			id: "collected",
			label: "Collected",
			checked,
			activate: () => {
				checked = !checked;
				dropdown.setOptions(options());
			},
		},
	];
	dropdown.setOptions(options());
	dropdown.getNavGrid().at(0)?.at(0)?.onInteract();
	expect(pool.acquire).toHaveBeenCalledWith("FilterDropdown");
	expect(changed).toHaveBeenCalledWith("collected");
	const node = dropdown
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "collected");
	node?.onFocus();
	expect(entries.at(0)?.enter).toHaveBeenCalled();
	node?.onBlur();
	expect(entries.at(0)?.leave).toHaveBeenCalled();
	node?.onFocus();
	node?.onInteract();
	expect(checked).toBe(true);
	expect(dropdown.isOpen()).toBe(true);
	expect(entries.at(0)?.checked?.()).toBe(true);
	expect(entries.at(0)?.label).toBe("Collected");
	expect(entries.at(0)?.enter).toHaveBeenCalled();
});

it.each([undefined, false])(
	"closes non-checkbox selections with selected=%s",
	(selected) => {
		const { dropdown, changed } = setup();
		const activate = vi.fn();
		dropdown.setOptions([
			{ id: "choice", label: "Choice", selected, activate },
		]);
		dropdown.getNavGrid().at(0)?.at(0)?.onInteract();
		dropdown
			.getNavGrid()
			.flat()
			.find((node) => node.navId === "choice")
			?.onInteract();
		expect(activate).toHaveBeenCalledOnce();
		expect(dropdown.isOpen()).toBe(false);
		expect(
			dropdown
				.getNavGrid()
				.flat()
				.map((node) => node.navId),
		).toEqual(["filters"]);
		expect(changed).toHaveBeenLastCalledWith("filters");
	},
);

it("refreshes navigation for mouse opening and outside dismissal and cleans up pooled menu state", () => {
	const { dropdown, native, changed } = setup();
	dropdown.setOptions([{ id: "choice", label: "Choice", activate: vi.fn() }]);
	native.SetMenuOpen(true);
	expect(changed).toHaveBeenLastCalledWith("choice");
	native.CloseMenu();
	expect(changed).toHaveBeenLastCalledWith("filters");
	dropdown.destroy();
	expect(native.ClearMenuState).toHaveBeenCalledOnce();
	expect(native.UnregisterCallback).toHaveBeenCalledWith(
		"OnMenuOpen",
		dropdown,
	);
	expect(native.UnregisterCallback).toHaveBeenCalledWith(
		"OnMenuClose",
		dropdown,
	);
});
