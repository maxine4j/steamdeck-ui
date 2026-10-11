import { INavigable } from "./types";

export interface INavManager {
    registerGrid(panelId: string, grid: INavigable[][]): void;
    setActiveGrid(panelId: string): void;
    moveUp(): void;
    moveDown(): void;
    moveLeft(): void;
    moveRight(): void;
    interact(): void;
}
