declare global {
	function GetCameraZoom(this: void): number;
	function CameraZoomIn(this: void, amount: number): void;
	function CameraZoomOut(this: void, amount: number): void;
}
export interface IDialogueCamera {
	begin(npc: boolean): void;
	end(): void;
}
/** Distance-only zoom: no targeting, forced facing, FOV or persistent settings. */
export class DialogueCamera implements IDialogueCamera {
	private original?: number;
	begin(npc: boolean): void {
		const exists = UnitExists as unknown as (
			this: void,
			unit: string,
		) => boolean;
		if (
			!npc ||
			this.original !== undefined ||
			InCombatLockdown() ||
			(!exists("questnpc") && !exists("npc"))
		)
			return;
		const zoom = GetCameraZoom();
		if (zoom <= 4) return;
		this.original = zoom;
		CameraZoomIn(zoom - 4);
	}
	end(): void {
		if (this.original === undefined) return;
		const delta = this.original - GetCameraZoom();
		this.original = undefined;
		if (delta > 0) CameraZoomOut(delta);
		else if (delta < 0) CameraZoomIn(-delta);
	}
}
