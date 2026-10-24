import { expect, it, vi } from "vitest";
import type {
	DialoguePage,
	IDialogueClient,
} from "../../clients/dialogue-client";
import { createTestEventBus } from "../../events/test-event-bus";
import type { IEventBus } from "../../events/types";
import { WowEventBus } from "../../events/wow-event-bus";
import type { WowEventFrame } from "../../types";
import { DialogueModule } from "./dialogue-module";

function current(module: DialogueModule): DialoguePage {
	if (!module.page) throw new Error("Expected dialogue page");
	return module.page;
}

function setup(events: IEventBus = createTestEventBus()) {
	let revision = 0;
	let combat = false;
	const queue: (() => void)[] = [];
	const client: IDialogueClient = {
		refresh: vi.fn((page) => ({ ...page, revision: ++revision })),
		read: vi.fn(
			(kind) =>
				({
					kind,
					session: 1,
					revision: ++revision,
					speaker: "Keeper",
					title: "Title",
					text: "Text",
					questID: 10,
					entries: [{ id: "option:8", label: "Talk" }],
					rewards: [],
					choices: [],
					cost: 0,
					completable: true,
					autoAccepted: false,
					pvp: false,
					requirements: [],
				}) as DialoguePage,
		),
		select: vi.fn(() => ({ ok: true })),
		accept: vi.fn(() => ({ ok: true })),
		advance: vi.fn(() => ({ ok: true })),
		claim: vi.fn(() => ({ ok: true })),
		prompt: vi.fn(),
		confirm: vi.fn(() => ({ ok: true })),
		cancelPrompt: vi.fn(),
		close: vi.fn(),
		end: vi.fn(),
		isInCombat: () => combat,
		isDialogueInteraction: (type) => type === 3 || type === 4,
	};
	const view = { show: vi.fn(), hide: vi.fn(), setActions: vi.fn() };
	const ui = { openPanel: vi.fn(), closePanel: vi.fn() };
	const native = { disable: vi.fn(), restore: vi.fn(), refresh: vi.fn() };
	const camera = { begin: vi.fn(), end: vi.fn() };
	const module = new DialogueModule(
		client,
		events,
		{
			nextFrame: (cb) => {
				let cancelled = false;
				queue.push(() => {
					if (!cancelled) cb();
				});
				return () => {
					cancelled = true;
				};
			},
		},
		view,
		ui,
		native,
		camera,
	);
	module.disableBuiltIn();
	module.initialize();
	return {
		module,
		events,
		client,
		view,
		ui,
		native,
		camera,
		flush: () => {
			while (queue.length) queue.shift()?.();
		},
		combat: (value: boolean) => {
			combat = value;
		},
	};
}
it("processes gossip-to-offer transitions immediately and arms input after rendering", () => {
	const s = setup();
	s.events.emit("GOSSIP_SHOW");
	s.flush();
	const old = current(s.module);
	s.module.select(old, "option:8");
	s.events.emit("GOSSIP_CLOSED", { continuing: true });
	s.events.emit("QUEST_DETAIL", {});
	expect(s.module.page?.kind).toBe("offer");
	expect(s.ui.closePanel).not.toHaveBeenCalled();
	s.module.primary(current(s.module));
	expect(s.client.accept).not.toHaveBeenCalled();
	s.flush();
	s.module.primary(current(s.module));
	expect(s.client.accept).toHaveBeenCalledOnce();
	s.module.select(old, "option:8");
	expect(s.client.select).toHaveBeenCalledOnce();
});
it("B cancels the current confirmation before closing the conversation", () => {
	const s = setup();
	s.events.emit("GOSSIP_SHOW");
	s.flush();
	s.events.emit("GOSSIP_CONFIRM", { optionID: 8, text: "Pay?", cost: 99 });
	s.flush();
	s.module.cancel();
	expect(s.client.cancelPrompt).toHaveBeenCalledOnce();
	expect(s.client.close).not.toHaveBeenCalled();
	s.flush();
	s.module.cancel();
	expect(s.client.close).toHaveBeenCalledOnce();
});
it.each(["gossip", "offer"] as const)(
	"invalidates a closed %s session before a same-frame reopen",
	(kind) => {
		const s = setup();
		if (kind === "gossip") s.events.emit("GOSSIP_SHOW");
		else s.events.emit("QUEST_DETAIL", {});
		s.flush();
		if (kind === "gossip")
			s.events.emit("GOSSIP_CLOSED", { continuing: false });
		else s.events.emit("QUEST_FINISHED");
		expect(s.client.end).toHaveBeenCalledOnce();
		if (kind === "gossip") s.events.emit("GOSSIP_SHOW");
		else s.events.emit("QUEST_DETAIL", {});
		s.flush();
		expect(s.client.end).toHaveBeenCalledOnce();
		expect(s.module.page?.kind).toBe(kind);
		expect(s.view.hide).not.toHaveBeenCalled();
	},
);
it("keeps selected rewards through item refresh and clears them for a new quest", () => {
	const s = setup();
	s.events.emit("QUEST_COMPLETE");
	s.flush();
	const page = current(s.module);
	if (page.kind !== "rewards") return;
	Object.assign(page, {
		choices: [
			{ id: "choice:1", index: 1, label: "A" },
			{ id: "choice:2", index: 2, label: "B" },
		],
	});
	s.module.choose(page, 2);
	s.events.emit("QUEST_ITEM_UPDATE");
	s.flush();
	expect(s.module.selectedReward).toBe(2);
	s.events.emit("QUEST_DETAIL", {});
	expect(s.module.selectedReward).toBeUndefined();
});
it("does not resurrect a conversation that ended during combat", () => {
	const s = setup();
	s.events.emit("QUEST_PROGRESS");
	s.flush();
	s.combat(true);
	s.events.emit("COMBAT_STARTED");
	s.module.primary(current(s.module));
	expect(s.client.advance).not.toHaveBeenCalled();
	s.events.emit("QUEST_FINISHED");
	s.combat(false);
	s.events.emit("COMBAT_ENDED");
	s.flush();
	expect(s.module.page).toBeUndefined();
	expect(s.view.hide).toHaveBeenCalled();
});
it.each(["open", "closed", "reopened"])(
	"resumes dialogue after native combat events with the conversation %s",
	(conversation) => {
		const registered = new Set<string>();
		let dispatch: (
			frame: WowEventFrame,
			event: string,
			...args: unknown[]
		) => void = () => {};
		const frame = {
			Hide: vi.fn(),
			RegisterEvent: (event: string) => registered.add(event),
			SetScript: (_name: string, handler: typeof dispatch) => {
				dispatch = handler;
			},
		} as unknown as WowEventFrame;
		const s = setup(new WowEventBus({ createEventFrame: () => frame }));
		const nativeEvent = (event: string, ...args: unknown[]) => {
			if (registered.has(event)) dispatch(frame, event, ...args);
		};
		nativeEvent("GOSSIP_SHOW");
		s.flush();
		s.combat(true);
		nativeEvent("PLAYER_REGEN_DISABLED");
		s.flush();
		expect(s.view.show).toHaveBeenLastCalledWith(
			expect.objectContaining({ suspended: true }),
		);
		s.module.select(current(s.module), "option:8");
		expect(s.client.select).not.toHaveBeenCalled();
		if (conversation !== "open") {
			vi.mocked(s.client.read).mockReturnValue({
				...current(s.module),
				session: 2,
				source: "Creature-2",
				speaker: "Another keeper",
			});
			nativeEvent("GOSSIP_CLOSED", false);
			s.flush();
			expect(s.module.page).toBeUndefined();
		}
		if (conversation === "reopened") {
			nativeEvent("GOSSIP_SHOW");
			s.flush();
		}
		s.combat(false);
		nativeEvent("PLAYER_REGEN_ENABLED");
		s.flush();
		if (conversation === "closed") {
			expect(s.module.page).toBeUndefined();
			nativeEvent("GOSSIP_SHOW");
			s.flush();
		}
		expect(s.view.show).toHaveBeenLastCalledWith(
			expect.objectContaining({ suspended: false }),
		);
		s.module.select(current(s.module), "option:8");
		expect(s.client.select).toHaveBeenCalledExactlyOnceWith(
			current(s.module),
			"option:8",
		);
	},
);
it("shutdown cancels pending renders, removes subscriptions, and restores camera and native UI", () => {
	const s = setup();
	s.events.emit("GOSSIP_SHOW");
	s.module.shutdown();
	s.flush();
	s.events.emit("QUEST_DETAIL", {});
	expect(s.view.show).not.toHaveBeenCalled();
	expect(s.native.restore).toHaveBeenCalledOnce();
	expect(s.camera.end).toHaveBeenCalled();
	expect(s.module.page).toBeUndefined();
});
it("gossip confirmations delivered synchronously by selection stay usable", () => {
	const s = setup();
	vi.mocked(s.client.select).mockImplementation(() => {
		s.events.emit("GOSSIP_CONFIRM", { optionID: 8, text: "Pay?", cost: 50 });
		return { ok: true };
	});
	s.events.emit("GOSSIP_SHOW");
	s.flush();
	const page = current(s.module);
	s.module.select(page, "option:8");
	s.flush();
	s.module.confirm(page);
	expect(s.client.confirm).toHaveBeenCalledWith(page, undefined);
});
it("service transitions close the conversation without closing the service", () => {
	const s = setup();
	s.events.emit("GOSSIP_SHOW");
	s.flush();
	s.module.select(current(s.module), "option:8");
	s.events.emit("GOSSIP_CLOSED", { continuing: true });
	s.events.emit("DIALOGUE_INTERACTION_SHOWN", { interactionType: 5 });
	s.flush();
	expect(s.module.page).toBeUndefined();
	expect(s.client.close).not.toHaveBeenCalled();
	expect(s.camera.end).toHaveBeenCalled();
});
it("queues remote notifications during another interaction, with no automatic claim", () => {
	const s = setup();
	s.events.emit("GOSSIP_SHOW");
	s.flush();
	s.events.emit("QUEST_AUTOCOMPLETE", { questID: 91 });
	s.events.emit("GOSSIP_CLOSED", { continuing: false });
	s.flush();
	expect(s.module.page?.kind).toBe("remote");
	expect(s.client.advance).not.toHaveBeenCalled();
	expect(s.client.claim).not.toHaveBeenCalled();
});
it("keeps reward selection through refresh and requires confirmation before claiming", () => {
	const s = setup();
	s.events.emit("QUEST_PROGRESS");
	s.flush();
	s.module.primary(current(s.module));
	expect(s.client.advance).toHaveBeenCalledOnce();
	s.events.emit("QUEST_COMPLETE");
	s.flush();
	const rewards = current(s.module);
	s.module.primary(rewards);
	s.flush();
	expect(s.client.claim).not.toHaveBeenCalled();
	s.module.confirm(rewards);
	s.flush();
	expect(s.client.claim).toHaveBeenCalledWith(rewards, undefined, true);
	s.module.confirm(rewards);
	expect(s.client.claim).toHaveBeenCalledOnce();
});
it("recovers from an authoritative API error without automatically retrying", () => {
	const s = setup();
	s.events.emit("QUEST_DETAIL", {});
	s.flush();
	s.module.primary(current(s.module));
	s.events.emit("DIALOGUE_ERROR", { message: "Quest log full" });
	s.flush();
	expect(s.client.accept).toHaveBeenCalledOnce();
	expect(s.view.show.mock.lastCall?.at(0).feedback).toBe("Quest log full");
});
