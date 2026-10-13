import { afterEach, expect, it, vi } from "vitest";
import type { IBankClient } from "../../clients/bank-client";
import { createTestEventBus } from "../../events/test-event-bus";
import { BankModule } from "./bank-module";
import { BuiltInBank } from "./built-in-bank";

afterEach(() => vi.unstubAllGlobals());

it("suppresses the native bank while retaining its logical state and restores on shutdown", () => {
	const frame = { GetParent: vi.fn() };
	vi.stubGlobal("_G", { BankFrame: frame });
	const frames = { suppress: vi.fn(), restore: vi.fn() };
	const builtIn = new BuiltInBank(frames);
	builtIn.disable();
	expect(frames.suppress).toHaveBeenCalledExactlyOnceWith([frame]);
	builtIn.restore();
	expect(frames.restore).toHaveBeenCalledOnce();
});

it("opens a dedicated left bank container with bags, batches bank updates and stops work on close", () => {
	const events = createTestEventBus();
	const ui = { openPanel: vi.fn(), closePanel: vi.fn() };
	const state = {
		available: true,
		unlockedTabs: 2,
		maxTabs: 5,
		canBuyTab: false,
		money: 0,
		characterMoney: 0,
		canDeposit: false,
		canWithdraw: false,
	};
	const client: IBankClient = {
		getState: vi.fn(() => state),
		getItems: vi.fn(() => []),
		setOpen: vi.fn(),
		select: vi.fn(),
		getDepositBankType: () => undefined,
		purchaseTab: vi.fn(),
		transferMoney: vi.fn(),
		close: vi.fn(),
		useItem: vi.fn(),
		pickupItem: vi.fn(),
	};
	const views = [{ refresh: vi.fn() }, { refresh: vi.fn() }];
	const native = { disable: vi.fn(), restore: vi.fn() };
	const pending: (() => void)[] = [];
	const scheduler = {
		nextFrame: (callback: () => void) => {
			let cancelled = false;
			pending.push(() => {
				if (!cancelled) callback();
			});
			return () => {
				cancelled = true;
			};
		},
	};
	const module = new BankModule(ui, events, client, views, native, scheduler);
	module.disableBuiltIn();
	module.initialize();
	expect(native.disable).toHaveBeenCalledOnce();
	events.emit("BAG_UPDATE_DELAYED");
	expect(pending).toHaveLength(0);
	events.emit("BANKFRAME_OPENED");
	expect(client.setOpen).toHaveBeenLastCalledWith(true);
	expect(ui.openPanel).toHaveBeenCalledWith("bags", "right");
	expect(ui.openPanel).toHaveBeenLastCalledWith("bank", "left", "bank");
	events.emit("ACCOUNT_MONEY");
	events.emit("BANK_TABS_CHANGED");
	events.emit("BAG_UPDATE_DELAYED");
	expect(pending).toHaveLength(1);
	pending.shift()?.();
	expect(views.at(0)?.refresh).toHaveBeenCalledTimes(2);
	events.emit("BANK_CONTENTS_CHANGED");
	expect(pending).toHaveLength(1);
	events.emit("BANK_TABS_CHANGED");
	events.emit("BANKFRAME_CLOSED");
	pending.shift()?.();
	expect(views.at(0)?.refresh).toHaveBeenCalledTimes(2);
	expect(client.setOpen).toHaveBeenLastCalledWith(false);
	expect(ui.closePanel).toHaveBeenLastCalledWith("left", undefined, "bank");
	module.shutdown();
	expect(native.restore).toHaveBeenCalledOnce();
	ui.openPanel.mockClear();
	events.emit("BANKFRAME_OPENED");
	expect(ui.openPanel).not.toHaveBeenCalled();
});
