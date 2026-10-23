declare global {
	var SteamDeckUILogs:
		| { version: 1; entries: string[]; droppedCount: number }
		| undefined;
}

/** Persistent breadcrumbs, independent of the smaller live debug panel buffer. */
export class SavedLogHistory {
	private loaded?: typeof SteamDeckUILogs;
	private characters = 0;
	constructor(
		private readonly limit = 10000,
		private readonly characterLimit = 2000000,
	) {}
	append(line: string): void {
		SteamDeckUILogs ??= { version: 1, entries: [], droppedCount: 0 };
		const saved = SteamDeckUILogs;
		if (this.loaded !== saved) {
			this.loaded = saved;
			this.characters = saved.entries.reduce(
				(sum, entry) => sum + entry.length,
				0,
			);
		}
		const entry = line.slice(0, this.characterLimit);
		saved.entries.push(entry);
		this.characters += entry.length;
		while (
			saved.entries.length > this.limit ||
			this.characters > this.characterLimit
		) {
			this.characters -= saved.entries.shift()?.length ?? 0;
			saved.droppedCount++;
		}
	}
}
