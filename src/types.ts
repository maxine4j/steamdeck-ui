/**
 * Minimal representation of WoW's native Frame object.
 * Adjust or extend if using @wartoshika/wow-declarations or your own WoW types.
 */
export interface WowFrame {
  Show: () => void;
  Hide: () => void;
  IsShown: () => boolean;
  SetParent: (parent: WowFrame) => void;
  ClearAllPoints: () => void;
  SetPoint: (point: string, relativeTo?: WowFrame, relativePoint?: string, x?: number, y?: number) => void;
  SetSize: (width: number, height: number) => void;
  // Frame hooks and script handlers
  SetScript: (scriptType: string, handler?: (...args: any[]) => void) => void;
}

// The pool that handles CreateFrame.
export interface IFramePoolManager {
    acquire(frameType: "Button" | "Frame" | "StatusBar"): any;
    release(frameType: string, frame: any): void;
}
