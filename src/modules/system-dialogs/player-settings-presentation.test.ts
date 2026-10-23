import { expect, it, vi } from "vitest";
import type { WowFrame } from "../../types";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import {
	PlayerSettingsPresentation,
	type PlayerSettingsSection,
} from "./player-settings-presentation";

const { frames, byId } = vi.hoisted(() => ({
	frames: [] as Record<string, ReturnType<typeof vi.fn>>[],
	byId: new Map<string, Record<string, ReturnType<typeof vi.fn>>[]>(),
}));
vi.mock("../../ui/components/frame", () => ({
	Frame: class {
		constructor(id: string) {
			frames.push(this as unknown as Record<string, ReturnType<typeof vi.fn>>);
			byId.set(id, [
				...(byId.get(id) ?? []),
				this as unknown as Record<string, ReturnType<typeof vi.fn>>,
			]);
		}
		setParent = vi.fn();
		layout = vi.fn();
		placeBeside = vi.fn(() => 550);
		setWindowBackground = vi.fn();
		setLabel = vi.fn();
		setLabelStyle = vi.fn();
		setButtonBackground = vi.fn();
		setInsetBackground = vi.fn();
		setColor = vi.fn();
		setBorder = vi.fn();
		setAtlasBackground = vi.fn();
		setTextureBackground = vi.fn();
		setOpacity = vi.fn();
		onClick = vi.fn();
		show = vi.fn();
		hide = vi.fn();
		destroy = vi.fn();
		setTooltip = vi.fn();
		setScrollContent = vi.fn();
		revealVerticalRange = vi.fn();
		resetScroll = vi.fn();
		clampScroll = vi.fn();
		navigationNode = vi.fn((navId, onInteract, onFocus) => ({
			navId,
			onInteract,
			onFocus: () => onFocus?.(),
			onBlur() {},
		}));
	},
}));

it("frames only radio groups and leaves the PvP checkbox without a red button background", () => {
	byId.clear();
	const presentation = new PlayerSettingsPresentation({} as IFramePoolManager);
	const sections: PlayerSettingsSection[] = [
		{
			id: "pvp",
			title: "PvP",
			options: [
				{
					id: "pvp",
					label: "PvP disabled",
					kind: "checkbox",
					checked: false,
					enabled: true,
					activate: vi.fn(),
				},
			],
		},
		{
			id: "loot",
			title: "Loot specialization",
			options: [
				{
					id: "loot:0",
					label: "Current",
					kind: "radio",
					checked: true,
					enabled: true,
					activate: vi.fn(),
				},
			],
		},
		{
			id: "reset",
			title: "Instances",
			options: [
				{
					id: "reset",
					label: "Reset All Instances",
					kind: "button",
					checked: false,
					enabled: true,
					activate: vi.fn(),
				},
			],
		},
	];
	presentation.render({} as WowFrame, sections);
	expect(
		byId.get("player-settings:pvp")?.at(0)?.setInsetBackground,
	).not.toHaveBeenCalled();
	expect(
		byId.get("player-settings:reset")?.at(0)?.setInsetBackground,
	).not.toHaveBeenCalled();
	expect(
		byId.get("player-settings:loot")?.at(0)?.setInsetBackground,
	).toHaveBeenCalled();
	expect(
		byId.get("player-settings:pvp")?.at(1)?.setButtonBackground,
	).not.toHaveBeenCalled();
	expect(
		byId.get("player-settings:reset")?.at(1)?.setButtonBackground,
	).toHaveBeenCalled();
});

it("reuses pooled custom controls, separates section headings, and distinguishes radio from checkbox artwork", () => {
	frames.length = 0;
	const presentation = new PlayerSettingsPresentation({} as IFramePoolManager);
	const activate = vi.fn();
	const sections = [
		{
			id: "pvp",
			title: "PvP",
			options: [
				{
					id: "pvp",
					label: "PvP enabled",
					kind: "checkbox" as const,
					checked: true,
					enabled: true,
					activate,
				},
			],
		},
		{
			id: "loot",
			title: "Loot specialization",
			options: [
				{
					id: "loot:0",
					label: "Current",
					kind: "radio" as const,
					checked: true,
					enabled: true,
					activate,
				},
			],
		},
	];
	presentation.render({} as WowFrame, sections);
	expect(
		frames.flatMap((frame) => frame.setAtlasBackground?.mock.calls ?? []),
	).toContainEqual(["checkbox-minimal"]);
	expect(
		frames.flatMap((frame) => frame.setTextureBackground?.mock.calls ?? []),
	).toContainEqual(["Interface\\Buttons\\UI-RadioButton", [0.25, 0.5, 0, 1]]);
	expect(frames.at(0)?.setWindowBackground).toHaveBeenCalled();
	const headings = frames
		.flatMap((frame) => frame.setLabel.mock.calls)
		.filter(
			(call) => call.at(0) === "section:pvp" || call.at(0) === "section:loot",
		);
	expect(headings).toHaveLength(2);
	expect(Number(headings.at(1)?.at(4))).toBeLessThan(
		Number(headings.at(0)?.at(4)) - 24,
	);
	presentation.grid().at(0)?.at(0)?.onInteract();
	expect(activate).toHaveBeenCalledOnce();
	presentation.grid().at(1)?.at(0)?.onFocus();
	expect(
		frames.some((frame) => frame.setScrollContent.mock.calls.length > 0),
	).toBe(true);
	expect(
		frames.some((frame) => frame.revealVerticalRange.mock.calls.length > 0),
	).toBe(true);
	const count = frames.length;
	presentation.hide();
	presentation.render({} as WowFrame, sections);
	expect(frames).toHaveLength(count);
	const viewport = frames.find(
		(frame) => frame.setScrollContent.mock.calls.length > 0,
	);
	if (!viewport) throw new Error("Missing settings scroll viewport");
	let offset = 500;
	viewport.clampScroll.mockImplementation(() => {
		offset = 0;
	});
	presentation.render({} as WowFrame, [
		{
			id: "pvp",
			title: "PvP",
			options: [
				{
					id: "pvp",
					label: "PvP enabled",
					kind: "checkbox",
					checked: true,
					enabled: false,
					activate,
				},
			],
		},
	]);
	expect(presentation.grid()).toEqual([]);
	expect(offset).toBe(0);
	expect(
		frames.some((frame) =>
			frame.setLabel.mock.calls.some(
				(call) => call.at(0) === "section:loot" && call.at(1) === "",
			),
		),
	).toBe(true);
	presentation.destroy();
	expect(frames.every((frame) => frame.destroy.mock.calls.length === 1)).toBe(
		true,
	);
});
