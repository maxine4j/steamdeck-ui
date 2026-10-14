import type { IControllerInputClient } from "../../clients/controller-input-client";
import type {
	BookSpell,
	ISpellbookClient,
} from "../../clients/spellbook-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import type { IEventBus } from "../../events/types";
import { Frame } from "../../ui/components/frame";
import type { IModalNavigation } from "../../ui/components/modal";
import { setWindowTitle } from "../../ui/components/window-title";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { ICrossBarPreview } from "../action-bar/cross-bar-preview";
export interface ISpellBindingPrompt {
	open(spell: BookSpell): void;
	close(): void;
}
export class SpellBindingPrompt implements ISpellBindingPrompt {
	private readonly backdrop: Frame;
	private readonly window: Frame;
	private opened = false;
	private cancelFinish?: () => void;
	private readonly dismiss = () => this.close();
	constructor(
		pool: IFramePoolManager,
		private readonly navigation: IModalNavigation,
		private readonly events: IEventBus,
		private readonly controller: Pick<
			IControllerInputClient,
			"setBindingCapture"
		>,
		private readonly client: ISpellbookClient,
		private readonly scheduler: ITaskScheduler,
		private readonly preview: ICrossBarPreview,
	) {
		this.backdrop = new Frame("spell-binding-backdrop", pool);
		this.window = new Frame("spell-binding-window", pool);
		events.subscribe("COMBAT_STARTED", this.dismiss);
	}
	open(spell: BookSpell): void {
		if (spell.passive || !this.client.canModify()) return;
		this.close();
		this.backdrop.modalBackdrop();
		this.backdrop.setColor(0, 0, 0, 0.65);
		this.backdrop.onClose(this.dismiss);
		this.window.setParent(this.backdrop);
		this.window.setModalLayer();
		const gap = 16;
		this.window.layout(
			440,
			230,
			"CENTER",
			this.backdrop,
			0,
			(this.preview.height + gap) / 2,
		);
		this.preview.show(this.backdrop, -(230 + gap) / 2);
		this.window.setWindowBackground();
		this.window.setFocusBorder(true);
		setWindowTitle(this.window, `Bind ${spell.name}`);
		this.window.setLabel(
			"instruction",
			"Press the controller bind you want for this spell.\nHold LT and/or LB for a modifier chord.",
			"CENTER",
			0,
			24,
			14,
			380,
		);
		this.window.setLabel(
			"status",
			"This replaces the spell in that action slot.",
			"CENTER",
			0,
			-32,
			12,
			380,
		);
		this.window.setLabel(
			"cancel",
			"Start / Escape to cancel",
			"BOTTOM",
			0,
			20,
			12,
		);
		this.opened = true;
		this.backdrop.show();
		this.window.show();
		this.navigation.pushModal("spell-binding", [], this.dismiss);
		this.controller.setBindingCapture((key) => {
			if (!this.opened || this.cancelFinish) return;
			if (key.split("-").at(-1) === "PADFORWARD") {
				this.cancelFinish = this.scheduler.nextFrame(this.dismiss);
				return;
			}
			const error = this.client.bind(spell.id, key);
			if (error)
				this.window.setLabel("status", error, "CENTER", 0, -32, 12, 380);
			else this.cancelFinish = this.scheduler.nextFrame(this.dismiss);
		});
	}
	close(): void {
		if (!this.opened) return;
		this.opened = false;
		this.cancelFinish?.();
		this.cancelFinish = undefined;
		this.controller.setBindingCapture();
		this.window.setFocusBorder(false);
		this.preview.hide();
		this.backdrop.hide();
		this.navigation.popModal("spell-binding");
	}
	destroy(): void {
		this.close();
		this.events.unsubscribe("COMBAT_STARTED", this.dismiss);
		this.window.destroy();
		this.preview.destroy();
		this.backdrop.destroy();
	}
}
