// Base interface for all UI elements.
// Hides the WoW Frame type (any) so business logic never sees it.
export interface IUIComponent {
    id: string;
    show(): void;
    hide(): void;
    setParent(parent: any): void; // 'any' represents WoW Frame. Mocked in tests.
    destroy(): void; // Returns the underlying frame to the FramePool
}
