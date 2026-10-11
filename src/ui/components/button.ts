import type { INavigable } from "../navigation/types";
import type { IUIComponent } from "./types";

export interface IButton extends IUIComponent, INavigable {
	setText(text: string): void;
	onClick(callback: () => void): void;
}
