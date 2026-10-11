import { INavigable } from "../navigation/types";
import { IUIComponent } from "./types";

export interface IButton extends IUIComponent, INavigable {
    setText(text: string): void;
    onClick(callback: () => void): void;
}
