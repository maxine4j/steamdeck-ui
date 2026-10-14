export interface NativeVisibleRegion {
	IsShown(): boolean;
	Show(): void;
	Hide(): void;
}

/** Reversible visibility ownership for existing frames and texture regions. */
export class NativeVisibility {
	private readonly originals = new Map<NativeVisibleRegion, boolean>();
	private readonly hooked = new Set<NativeVisibleRegion>();
	hide(regions: readonly NativeVisibleRegion[]): void {
		for (const region of regions) {
			if (!this.originals.has(region))
				this.originals.set(region, region.IsShown());
			if (!this.hooked.has(region)) {
				this.hooked.add(region);
				const hook = hooksecurefunc as unknown as (
					this: void,
					target: NativeVisibleRegion,
					method: string,
					callback: (this: void) => void,
				) => void;
				for (const method of ["Show", "SetShown"])
					hook(region, method, () => {
						if (this.originals.has(region)) region.Hide();
					});
			}
			region.Hide();
		}
	}
	restore(): void {
		const originals = [...this.originals];
		this.originals.clear();
		for (const [region, shown] of originals) {
			if (shown) region.Show();
			else region.Hide();
		}
	}
}
