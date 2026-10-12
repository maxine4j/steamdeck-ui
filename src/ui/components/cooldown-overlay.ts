import type { WowFrame } from "../../types";
import type { IFramePoolManager } from "../frame-pool-manager";

/** Opaque native duration: cooldown values can be secret in combat. */
export interface CooldownDuration {
	readonly durationObject?: never;
}
interface CooldownFrame extends WowFrame {
	SetCooldownFromDurationObject(
		duration: CooldownDuration,
		clearIfZero: boolean,
	): void;
	SetHideCountdownNumbers(hide: boolean): void;
	SetDrawEdge(draw: boolean): void;
	SetDrawSwipe(draw: boolean): void;
	SetCountdownFormatter(formatter?: SecondsFormatter): void;
	Clear(): void;
}
interface SecondsFormatter {
	SetDefaultAbbreviation(abbreviation: number): void;
	SetConvertToLower(convert: boolean): void;
	SetStripIntervalWhitespace(strip: number): void;
	SetDesiredUnitCount(count: number): void;
	SetMaxInterval(interval: number): void;
	SetMinInterval(interval: number): void;
	SetMillisecondsThreshold(seconds: number): void;
}

/** Shared native cooldown and charge presentation, including compact countdowns. */
export class CooldownOverlay {
	private readonly frames: CooldownFrame[];
	constructor(
		private readonly pool: IFramePoolManager,
		parent: WowFrame,
	) {
		const formatter =
			C_StringUtil.CreateSecondsFormatter() as unknown as SecondsFormatter;
		// OneLetter = 2, StripIgnoreLocale = 2: compact suffixes such as 8s and 2m.
		formatter.SetDefaultAbbreviation(2);
		formatter.SetConvertToLower(true);
		formatter.SetStripIntervalWhitespace(2);
		formatter.SetDesiredUnitCount(1);
		// Restrict units to seconds (0) and minutes (1).
		formatter.SetMaxInterval(1);
		formatter.SetMinInterval(0);
		formatter.SetMillisecondsThreshold(0);
		this.frames = [0, 1].map(() => {
			const frame = pool.acquire("Cooldown") as CooldownFrame;
			frame.SetParent(parent);
			// Replace template anchors, which can still point to UIParent.
			frame.ClearAllPoints();
			frame.SetPoint("TOPLEFT", parent, "TOPLEFT", 2, -2);
			frame.SetPoint("BOTTOMRIGHT", parent, "BOTTOMRIGHT", -2, 2);
			frame.SetHideCountdownNumbers(false);
			frame.SetCountdownFormatter(formatter);
			frame.SetDrawEdge(false);
			frame.SetDrawSwipe(true);
			frame.Show();
			return frame;
		});
	}
	refresh(cooldown?: CooldownDuration, recharge?: CooldownDuration): void {
		this.update(this.frames.at(0), recharge);
		this.update(this.frames.at(1), cooldown);
	}
	private update(
		frame: CooldownFrame | undefined,
		duration: CooldownDuration | undefined,
	): void {
		if (!frame) return;
		if (duration === undefined) frame.Clear();
		else frame.SetCooldownFromDurationObject(duration, true);
	}
	destroy(): void {
		for (const frame of this.frames) {
			frame.Clear();
			frame.SetCountdownFormatter(undefined);
			this.pool.release("Cooldown", frame);
		}
	}
}
