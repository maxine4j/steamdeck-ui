import { expect, it, vi } from "vitest";
import type { Reputation } from "../../clients/reputation-client";
import type { ModalOption } from "../../ui/components/modal";
import { ReputationActionMenu } from "./reputation-action-menu";

const reputation: Reputation = {
	index: 1,
	id: 42,
	name: "Faction",
	description: "Description",
	header: false,
	child: false,
	collapsed: false,
	hasReputation: true,
	watched: false,
	standing: "Friendly",
	progress: "",
	reaction: 5,
	current: 0,
	maximum: 6000,
	maxed: false,
};

it("offers permitted reputation options, dispatches actions and refreshes", () => {
	let options: readonly ModalOption[] = [];
	const modal = {
		open: vi.fn((_title: string, next: readonly ModalOption[]) => {
			options = next;
		}),
		close: vi.fn(),
	};
	const client = {
		activate: vi.fn(),
		toggleAtWar: vi.fn(),
		toggleInactive: vi.fn(),
	};
	const refresh = vi.fn();
	const menu = new ReputationActionMenu(modal, client, refresh);
	menu.open({ ...reputation, canToggleAtWar: true, canSetInactive: true });
	expect(modal.open).toHaveBeenCalledWith(
		"Faction options",
		expect.any(Array),
		{ text: "Description" },
	);
	expect(options.map((option) => option.label)).toEqual([
		"Track reputation",
		"Declare war",
		"Make inactive",
		"Cancel",
	]);
	options.at(0)?.select();
	options.at(1)?.select();
	options.at(2)?.select();
	expect(client.activate).toHaveBeenCalledOnce();
	expect(client.toggleAtWar).toHaveBeenCalledOnce();
	expect(client.toggleInactive).toHaveBeenCalledOnce();
	expect(refresh).toHaveBeenCalledTimes(3);
	menu.open({
		...reputation,
		watched: true,
		atWar: true,
		inactive: true,
		canToggleAtWar: true,
		canSetInactive: true,
	});
	expect(options.map((option) => option.label)).toEqual([
		"Stop tracking",
		"Make peace",
		"Make active",
		"Cancel",
	]);
	options.at(3)?.select();
	expect(modal.close).toHaveBeenCalledOnce();
	menu.open(reputation);
	expect(options.map((option) => option.id)).toEqual(["track", "cancel"]);
	menu.open({ ...reputation, seasonal: true });
	expect(options.map((option) => option.id)).toEqual(["track", "cancel"]);
	menu.open({ ...reputation, locked: true });
	expect(options.map((option) => option.id)).toEqual(["cancel"]);
	menu.open({ ...reputation, hasReputation: false });
	expect(options.map((option) => option.id)).toEqual(["cancel"]);
});
