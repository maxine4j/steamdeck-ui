import type { WowFrame } from "../../types";
import type { IFramePoolManager } from "../frame-pool-manager";
import type { Frame } from "./frame";

export interface ClickBinding {
	key: string;
	target: Frame;
	button?: "LeftButton" | "RightButton";
}

type BindingFrame = WowFrame & {
	SetAttribute(name: string, value?: string | number): void;
};

const APPLY_BINDINGS = `
self:ClearBindings()
for i = 1, self:GetAttribute("count") or 0 do
	self:SetBindingClick(true, self:GetAttribute("key"..i), self:GetAttribute("target"..i), self:GetAttribute("button"..i))
end
`;

/** Hardware clicks remain secure; combat releases these bindings to gameplay. */
export class SecureClickBindings {
	private frame?: BindingFrame;
	private count = 0;
	constructor(private readonly pool: IFramePoolManager) {}
	set(bindings: readonly ClickBinding[]): void {
		if (InCombatLockdown()) return;
		if (!this.frame && bindings.length === 0) return;
		if (!this.frame) {
			this.frame = this.pool.acquire("SecureFrame") as BindingFrame;
			this.frame.SetAttribute(
				"_onstate-combat",
				'if newstate == "combat" then self:ClearBindings() end',
			);
			RegisterStateDriver(this.frame, "combat", "[combat] combat; peace");
		}
		bindings.forEach((binding, index) => {
			this.frame?.SetAttribute(
				`button${index + 1}`,
				binding.button ?? "LeftButton",
			);
			this.frame?.SetAttribute(`key${index + 1}`, binding.key);
			this.frame?.SetAttribute(
				`target${index + 1}`,
				binding.target.secureClickName(),
			);
		});
		for (let index = bindings.length; index < this.count; index++) {
			this.frame.SetAttribute(`key${index + 1}`, undefined);
			this.frame.SetAttribute(`target${index + 1}`, undefined);
			this.frame.SetAttribute(`button${index + 1}`, undefined);
		}
		this.count = bindings.length;
		this.frame.SetAttribute("count", this.count);
		SecureHandlerExecute(this.frame, APPLY_BINDINGS);
	}
	destroy(): void {
		if (!this.frame || InCombatLockdown()) return;
		this.set([]);
		UnregisterStateDriver(this.frame, "combat");
		this.frame.SetAttribute("_onstate-combat", undefined);
		this.frame.SetAttribute("state-combat", undefined);
		this.frame.SetAttribute("count", undefined);
		this.pool.release("SecureFrame", this.frame);
		this.frame = undefined;
	}
}
