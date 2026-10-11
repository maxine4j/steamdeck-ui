export interface INavigable {
	navId: string;
	onFocus(): void;
	onBlur(): void;
	onInteract(): void; // Maps to A button
}
