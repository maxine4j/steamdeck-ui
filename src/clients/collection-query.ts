export interface CollectionFilter {
	readonly id: string;
	readonly label: string;
	readonly checked: boolean;
}

export interface ICollectionQuery {
	search(text: string): void;
	getFilters(): CollectionFilter[];
	toggleFilter(id: string): void;
}
