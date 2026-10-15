/** Visible UI projection holding references to authoritative SavedVariables rows. */
export class CollectionView<T extends object> {
	private readonly entries = new Map<string, T>();
	constructor(
		private readonly key: (this: void, row: T) => string,
		private readonly included: (this: void, row: T) => boolean,
	) {}
	get(key: string): T | undefined {
		return this.entries.get(key);
	}
	values(): T[] {
		return [...this.entries.values()];
	}
	replace(rows: readonly T[]): void {
		const wanted = new Set(
			rows.filter((row) => this.included(row)).map((row) => this.key(row)),
		);
		for (const key of this.entries.keys())
			if (!wanted.has(key)) this.entries.delete(key);
		this.update(rows);
	}
	update(rows: readonly T[]): boolean {
		let changed = false;
		for (const row of rows) {
			const key = this.key(row);
			if (!this.included(row)) {
				changed = this.entries.delete(key) || changed;
				continue;
			}
			const previous = this.entries.get(key);
			const before = previous as Record<string, unknown> | undefined;
			const after = row as Record<string, unknown>;
			if (
				before &&
				Object.keys(before).length === Object.keys(after).length &&
				Object.keys(after).every((field) => before[field] === after[field])
			)
				continue;
			this.entries.set(key, row);
			changed = true;
		}
		return changed;
	}
}
