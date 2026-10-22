import type { WowFrame } from "../../types";
import type { IFramePoolManager } from "../frame-pool-manager";
import { Frame } from "./frame";
import type { NativeDialogFrame } from "./native-dialog-navigation";
import { applyWindowSkin } from "./skin";

type MenuBorder = WowFrame & {
	SetFrameLevel(level: number): void;
	EnableMouse(enabled: boolean): void;
};
interface MenuChrome {
	GetAlpha(): number;
	SetAlpha(alpha: number): void;
}

/** Positions an existing menu beside its owner and reuses a pooled window skin. */
export class NativeMenuHost {
	private border?: MenuBorder;
	private chrome?: MenuChrome;
	private chromeAlpha = 1;
	private readonly actions = new Map<string, Frame>();
	constructor(private readonly pool: IFramePoolManager) {}
	prepareAction(
		id: string,
		action: "focus" | "leavevehicle",
		unit: string | undefined,
		clicked: () => void,
	): void {
		if (this.actions.has(id) || InCombatLockdown()) return;
		const button = new Frame(id, this.pool, "SecureButton");
		button.setUnitAction(action, unit);
		button.onPostClick(() => clicked());
		button.show();
		this.actions.set(id, button);
	}
	getAction(id: string): Frame | undefined {
		return this.actions.get(id);
	}
	destroy(): boolean {
		this.release();
		if (InCombatLockdown()) return false;
		for (const action of this.actions.values()) action.destroy();
		this.actions.clear();
		return true;
	}
	place(menu: NativeDialogFrame, owner: NativeDialogFrame): void {
		menu.ClearAllPoints();
		menu.SetPoint("TOPRIGHT", owner, "TOPLEFT", -24, 0);
		if (!this.border) this.border = this.pool.acquire("Frame") as MenuBorder;
		const border = this.border;
		if (!border) return;
		const chrome = (menu as NativeDialogFrame & { NineSlice?: MenuChrome })
			.NineSlice;
		if (chrome !== this.chrome) {
			this.chrome?.SetAlpha(this.chromeAlpha);
			this.chrome = chrome;
			this.chromeAlpha = chrome?.GetAlpha() ?? 1;
		}
		chrome?.SetAlpha(0);
		border.SetParent(menu);
		border.SetFrameStrata("PARENT");
		border.SetFrameLevel(Math.max(0, menu.GetFrameLevel() - 1));
		border.EnableMouse(false);
		border.ClearAllPoints();
		border.SetPoint("TOPLEFT", menu, "TOPLEFT", -4, 4);
		border.SetPoint("BOTTOMRIGHT", menu, "BOTTOMRIGHT", 4, -4);
		applyWindowSkin(this.pool, border);
		border.Show();
	}
	release(): void {
		this.chrome?.SetAlpha(this.chromeAlpha);
		this.chrome = undefined;
		if (this.border) this.pool.release("Frame", this.border);
		this.border = undefined;
	}
}
