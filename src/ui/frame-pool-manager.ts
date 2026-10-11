
// The pool that handles CreateFrame.
export interface IFramePoolManager {
    acquire(frameType: "Button" | "Frame" | "StatusBar"): any;
    release(frameType: string, frame: any): void;
}
