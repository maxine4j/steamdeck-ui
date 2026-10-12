import type { ICollectionsClient } from "../../clients/collections-client";
export interface IBuiltInMounts {
	disable(): void;
	restore(): void;
	isOpen(): boolean;
}
export class BuiltInMounts implements IBuiltInMounts {
	constructor(private readonly client: ICollectionsClient) {}
	isOpen(): boolean {
		return this.client.isOpen("mounts");
	}
	close(): void {
		this.client.close();
	}
	disable(): void {
		this.client.disable("mounts");
	}
	restore(): void {
		this.client.restore("mounts");
	}
}
