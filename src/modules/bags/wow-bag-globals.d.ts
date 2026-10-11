import type { WowFrame } from "../../types";

/** Blizzard FrameXML helpers and objects, absent from generated game APIs. */
declare global {
	const ContainerFrameCombinedBags: WowFrame & {
		GetParent(): WowFrame | undefined;
	};
	const ContainerFrame1: typeof ContainerFrameCombinedBags;
	const ContainerFrame2: typeof ContainerFrameCombinedBags;
	const ContainerFrame3: typeof ContainerFrameCombinedBags;
	const ContainerFrame4: typeof ContainerFrameCombinedBags;
	const ContainerFrame5: typeof ContainerFrameCombinedBags;
	const ContainerFrame6: typeof ContainerFrameCombinedBags;
	function IsBagOpen(this: void, bagId: number): boolean;
	function hooksecurefunc(
		this: void,
		name: string,
		callback: (this: void) => void,
	): void;
}
