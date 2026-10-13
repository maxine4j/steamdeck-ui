declare global {
	function GetCameraZoom(this: void): number;
	function CameraZoomIn(this: void, amount: number): void;
	function CameraZoomOut(this: void, amount: number): void;
}
export interface IDialogueCamera {
	begin(npc: boolean): void;
	end(): void;
}
/** Interaction focus and shoulder framing, restored with the conversation's zoom. */
export class DialogueCamera implements IDialogueCamera {
	private original?: number;
	private readonly settings = new Map<string, string>();
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
		if (zoom <= 0) return;
		this.original = zoom;
		// DialogueUI's interaction camera settings; positive shoulder offset leaves
		// the NPC to the left of our right-side conversation panel.
		for (const [name, value] of [
			["test_cameraTargetFocusInteractEnable", 1],
			["test_cameraTargetFocusInteractStrengthPitch", 1],
			["test_cameraTargetFocusInteractStrengthYaw", 0],
			["test_cameraOverShoulder", 1.5],
			["test_cameraHeadMovementStrength", 0],
			["CameraKeepCharacterCentered", 0],
			["CameraReduceUnexpectedMovement", 0],
		] as const) {
			const original = C_CVar.GetCVar(name);
			if (original === null) continue;
			this.settings.set(name, original);
			C_CVar.SetCVar(name, `${value}`);
		}
		if (zoom > 4) CameraZoomIn(zoom - 4);
	}
	end(): void {
		if (this.original === undefined) return;
		const delta = this.original - GetCameraZoom();
		this.original = undefined;
		for (const [name, value] of this.settings) C_CVar.SetCVar(name, value);
		this.settings.clear();
		if (delta > 0) CameraZoomOut(delta);
		else if (delta < 0) CameraZoomIn(-delta);
	}
}
