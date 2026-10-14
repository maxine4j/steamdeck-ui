export interface ITargetingClient {
	getPosition(): number;
}

export class TargetingClient implements ITargetingClient {
	getPosition(): number {
		return Number(C_CVar.GetCVar("CursorCenteredYPos"));
	}
}
