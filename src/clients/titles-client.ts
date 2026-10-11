export interface PlayerTitle {
	readonly id: number;
	readonly name: string;
	readonly selected: boolean;
}
export interface ITitlesClient {
	getTitles(): PlayerTitle[];
	select(id: number): void;
}
export class TitlesClient implements ITitlesClient {
	getTitles(): PlayerTitle[] {
		const current = GetCurrentTitle();
		const titles: PlayerTitle[] = [];
		for (let id = 1; id <= GetNumTitles(); id++) {
			if (!IsTitleKnown(id)) continue;
			const [name, playerTitle] = GetTitleName(id);
			if (name && playerTitle)
				titles.push({ id, name: name.trim(), selected: current === id });
		}
		titles.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
		titles.unshift({
			id: -1,
			name: "None",
			selected: !titles.some((title) => title.selected),
		});
		return titles;
	}
	select(id: number): void {
		if (id === -1) SetCurrentTitle(-1);
		else if (id > 0 && id <= GetNumTitles() && IsTitleKnown(id)) {
			const [, playerTitle] = GetTitleName(id);
			if (playerTitle) SetCurrentTitle(id);
		}
	}
}
