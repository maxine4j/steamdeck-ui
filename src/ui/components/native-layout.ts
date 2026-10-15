import type { ITaskScheduler } from "../../clients/task-scheduler";
import type { WowFrame } from "../../types";
import { Frame } from "./frame";

export interface LayoutFrame extends WowFrame {
	Raise(): void;
	IsFrameBuffer(): boolean;
	SetIsFrameBuffer(enabled: boolean): void;
	GetFrameLevel(): number;
	SetFrameLevel(level: number): void;
	IsMouseEnabled(): boolean;
	EnableMouse(enabled: boolean): void;
	DoesClipChildren(): boolean;
	SetClipsChildren(clip: boolean): void;
	IsShown(): boolean;
	SetFrameStrata(strata: string): void;
	GetParent(): LayoutFrame | undefined;
	GetNumPoints(): number;
	GetPoint(
		index: number,
	): LuaMultiReturn<[string, LayoutFrame | undefined, string, number, number]>;
	GetSize(): LuaMultiReturn<[number, number]>;
	GetScale(): number;
	GetFrameStrata(): string;
	GetAlpha(): number;
	SetScale(scale: number): void;
	SetAlpha(alpha: number): void;
}
export interface NativeLayoutRule {
	readonly raised?: boolean;
	readonly frameBuffer?: boolean;
	/** Render above/below the anchoring host while preserving the script parent. */
	readonly levelOffset?: number;
	readonly size?: readonly [number, number];
	readonly mouse?: boolean;
	readonly clip?: boolean;
	readonly parent?: LayoutFrame | Frame;
	readonly insets?: readonly [number, number, number, number];
	readonly reparent?: boolean;
	readonly visible?: boolean;
	readonly scale?: number;
	readonly strata?: string;
	readonly alpha?: number;
	readonly anchors?: readonly (readonly [string, string, number, number])[];
}
export class NativeLayout {
	private readonly pending = new Map<LayoutFrame, () => void>();
	constructor(private readonly scheduler: ITaskScheduler) {}
	private readonly rules = new Map<LayoutFrame, NativeLayoutRule>();
	private readonly originals = new Map<
		LayoutFrame,
		{
			parent?: LayoutFrame;
			points: [string, LayoutFrame | undefined, string, number, number][];
			width: number;
			height: number;
			scale: number;
			strata: string;
			alpha: number;
			shown: boolean;
			visibilityOwned: boolean;
			mouse?: boolean;
			clip?: boolean;
			level?: number;
			frameBuffer?: boolean;
		}
	>();
	private readonly hooked = new Set<LayoutFrame>();
	private applying = false;
	bind(frame: LayoutFrame, rule: NativeLayoutRule): void {
		if (!this.originals.has(frame)) {
			const points: [
				string,
				LayoutFrame | undefined,
				string,
				number,
				number,
			][] = [];
			for (let i = 1; i <= frame.GetNumPoints(); i++) {
				const [point, relative, relativePoint, x, y] = frame.GetPoint(i);
				points.push([point, relative, relativePoint, x, y]);
			}
			const [width, height] = frame.GetSize();
			this.originals.set(frame, {
				parent: frame.GetParent(),
				points,
				width,
				height,
				scale: frame.GetScale(),
				strata: frame.GetFrameStrata(),
				alpha: frame.GetAlpha(),
				shown: frame.IsShown(),
				visibilityOwned: rule.visible !== undefined,
			});
		}
		this.rules.set(frame, rule);
		const original = this.originals.get(frame);
		if (original && rule.visible !== undefined) original.visibilityOwned = true;
		if (original && rule.mouse !== undefined && original.mouse === undefined)
			original.mouse = frame.IsMouseEnabled();
		if (original && rule.clip !== undefined && original.clip === undefined)
			original.clip = frame.DoesClipChildren();
		if (
			original &&
			rule.levelOffset !== undefined &&
			original.level === undefined
		)
			original.level = frame.GetFrameLevel();
		if (
			original &&
			rule.frameBuffer !== undefined &&
			original.frameBuffer === undefined
		)
			original.frameBuffer = frame.IsFrameBuffer();
		if (!this.hooked.has(frame)) {
			this.hooked.add(frame);
			for (const method of [
				"SetPoint",
				"SetAllPoints",
				"ClearAllPoints",
				"SetSize",
				"SetWidth",
				"SetHeight",
				"SetParent",
				"SetScale",
				"SetFrameStrata",
				"SetFrameLevel",
				"SetIsFrameBuffer",
				"Raise",
				"SetAlpha",
				"Show",
				"Hide",
				"SetShown",
				"EnableMouse",
				"SetClipsChildren",
			])
				hooksecurefunc(frame, method, () => {
					if (this.applying || !this.rules.has(frame)) return;
					// Do not insert our anchors between a native ClearAllPoints/SetPoint batch.
					if (
						method === "ClearAllPoints" ||
						method === "SetPoint" ||
						method === "SetAllPoints" ||
						this.pending.has(frame)
					)
						this.defer(frame);
					else this.apply(frame);
				});
		}
		if (this.pending.has(frame)) this.defer(frame);
		else this.apply(frame);
	}
	private defer(frame: LayoutFrame): void {
		if (this.pending.has(frame)) return;
		this.pending.set(
			frame,
			this.scheduler.nextFrame(() => {
				this.pending.delete(frame);
				this.apply(frame);
			}),
		);
	}
	private apply(frame: LayoutFrame): void {
		const rule = this.rules.get(frame);
		if (!rule || this.applying) return;
		this.applying = true;
		if (rule.parent) {
			const insets = rule.insets ?? [0, 0, 0, 0];
			if (rule.parent instanceof Frame)
				rule.parent.anchorExisting(frame, insets, rule.reparent, rule.anchors);
			else {
				if (rule.reparent) frame.SetParent(rule.parent);
				frame.ClearAllPoints();
				if (rule.anchors) {
					for (const [point, relativePoint, x, y] of rule.anchors)
						frame.SetPoint(point, rule.parent, relativePoint, x, y);
				} else {
					const [left, top, right, bottom] = insets;
					frame.SetPoint(
						"TOPLEFT",
						rule.parent,
						"TOPLEFT",
						left,
						top !== 0 ? -top : 0,
					);
					frame.SetPoint(
						"BOTTOMRIGHT",
						rule.parent,
						"BOTTOMRIGHT",
						right !== 0 ? -right : 0,
						bottom,
					);
				}
			}
		}
		if (rule.scale !== undefined) frame.SetScale(rule.scale);
		if (rule.size) frame.SetSize(...rule.size);
		if (rule.mouse !== undefined) frame.EnableMouse(rule.mouse);
		if (rule.clip !== undefined) frame.SetClipsChildren(rule.clip);
		if (rule.strata !== undefined) frame.SetFrameStrata(rule.strata);
		if (rule.levelOffset !== undefined && rule.parent) {
			const hostLevel =
				rule.parent instanceof Frame
					? rule.parent.getFrameLevel()
					: rule.parent.GetFrameLevel();
			frame.SetFrameLevel(hostLevel + rule.levelOffset);
		}
		if (rule.alpha !== undefined) frame.SetAlpha(rule.alpha);
		if (rule.frameBuffer !== undefined)
			frame.SetIsFrameBuffer(rule.frameBuffer);
		if (rule.visible !== undefined) {
			if (rule.visible) frame.Show();
			else frame.Hide();
		}
		if (rule.raised) frame.Raise();
		this.applying = false;
	}
	scroll(
		control: { ScrollStepInDirection(direction: number): void },
		direction: -1 | 1,
	): void {
		control.ScrollStepInDirection(direction);
	}
	scrollToEnd(control: { ScrollToEnd(): void }): void {
		control.ScrollToEnd();
	}
	release(): void {
		for (const cancel of this.pending.values()) cancel();
		this.pending.clear();
		this.rules.clear();
		this.applying = true;
		for (const [frame, original] of this.originals) {
			frame.SetParent(original.parent);
			frame.ClearAllPoints();
			frame.SetSize(original.width, original.height);
			for (const [point, relative, relativePoint, x, y] of original.points)
				frame.SetPoint(point, relative, relativePoint, x, y);
			frame.SetScale(original.scale);
			frame.SetFrameStrata(original.strata);
			if (original.level !== undefined) frame.SetFrameLevel(original.level);
			if (original.frameBuffer !== undefined)
				frame.SetIsFrameBuffer(original.frameBuffer);
			frame.SetAlpha(original.alpha);
			if (original.mouse !== undefined) frame.EnableMouse(original.mouse);
			if (original.clip !== undefined) frame.SetClipsChildren(original.clip);
			if (original.visibilityOwned) {
				if (original.shown) frame.Show();
				else frame.Hide();
			}
		}
		this.originals.clear();
		this.applying = false;
	}
}
