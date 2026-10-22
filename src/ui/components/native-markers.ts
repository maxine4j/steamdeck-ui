import type { WowFrame, WowTexture } from "../../types";
import type { IFramePoolManager } from "../frame-pool-manager";
import type { NativeNavigationFrame } from "./native-navigation";
import type { NativeVisibleRegion } from "./native-visibility";

type MarkerTexture = WowTexture & {
	SetSize(width: number, height: number): void;
	Show(): void;
	Hide(): void;
};

export interface NativeMarker {
	readonly owner: NativeNavigationFrame;
	readonly replace: readonly NativeVisibleRegion[];
	readonly atlas: string;
	readonly size: number;
	readonly badge?: {
		readonly atlas: string;
		readonly size: number;
		readonly x: number;
	};
}

export class NativeMarkers {
	private readonly leases = new Map<
		NativeNavigationFrame,
		{
			frame: WowFrame;
			originals: Map<NativeVisibleRegion, boolean>;
		}
	>();
	constructor(private readonly pool: IFramePoolManager) {}
	sync(markers: readonly NativeMarker[]): void {
		const owners = new Set(markers.map((marker) => marker.owner));
		for (const [owner] of this.leases) {
			if (!owners.has(owner)) this.remove(owner);
		}
		for (const marker of markers) {
			let lease = this.leases.get(marker.owner);
			if (!lease) {
				lease = { frame: this.pool.acquire("Frame"), originals: new Map() };
				this.leases.set(marker.owner, lease);
			}
			for (const region of marker.replace) {
				if (!lease.originals.has(region))
					lease.originals.set(region, region.IsShown());
				region.Hide();
			}
			const frame = lease.frame as WowFrame & {
				SetFrameLevel(level: number): void;
				EnableMouse(enabled: boolean): void;
			};
			frame.SetParent(marker.owner);
			frame.ClearAllPoints();
			frame.SetPoint("CENTER", marker.owner, "CENTER", 0, 0);
			frame.SetSize(marker.size, marker.size);
			frame.SetFrameLevel(marker.owner.GetFrameLevel() + 1);
			frame.EnableMouse(false);
			const icon = this.pool.getDecoration(frame, "marker") as MarkerTexture;
			icon.ClearAllPoints();
			icon.SetPoint("CENTER", frame, "CENTER", 0, 0);
			icon.SetSize(marker.size, marker.size);
			icon.SetAtlas(marker.atlas, false);
			icon.Show();
			const badge = this.pool.getDecoration(
				frame,
				"marker-badge",
			) as MarkerTexture;
			badge.Hide();
			if (marker.badge) {
				badge.ClearAllPoints();
				badge.SetPoint("CENTER", frame, "CENTER", marker.badge.x, 0);
				badge.SetSize(marker.badge.size, marker.badge.size);
				badge.SetAtlas(marker.badge.atlas, false);
				badge.Show();
			}
			frame.Show();
		}
	}
	private remove(owner: NativeNavigationFrame): void {
		const lease = this.leases.get(owner);
		if (!lease) return;
		this.leases.delete(owner);
		(this.pool.getDecoration(lease.frame, "marker") as MarkerTexture).Hide();
		(
			this.pool.getDecoration(lease.frame, "marker-badge") as MarkerTexture
		).Hide();
		for (const [region, shown] of lease.originals) {
			if (shown) region.Show();
			else region.Hide();
		}
		this.pool.release("Frame", lease.frame);
	}
	release(): void {
		for (const [owner] of this.leases) this.remove(owner);
	}
}
