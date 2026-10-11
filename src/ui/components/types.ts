export interface IUIComponent {
	readonly id: string;
	show(): void;
	hide(): void;
	setParent(parent: IUIComponent): void;
	destroy(): void;
}
