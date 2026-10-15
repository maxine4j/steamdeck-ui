/** Presentation coverage; skipped or unfinished ranges must not be recorded. */
export class PreparedRanges {
	private ranges: { top: number; bottom: number }[] = [];
	reset(): void {
		this.ranges = [];
	}
	includes(range: { top: number; bottom: number }): boolean {
		return this.ranges.some(
			(prepared) =>
				range.top >= prepared.top && range.bottom <= prepared.bottom,
		);
	}
	remember(top: number, bottom: number): void {
		const retained: { top: number; bottom: number }[] = [];
		for (const range of this.ranges) {
			if (range.bottom < top || range.top > bottom) retained.push(range);
			else {
				top = Math.min(top, range.top);
				bottom = Math.max(bottom, range.bottom);
			}
		}
		retained.push({ top, bottom });
		this.ranges = retained;
	}
}
