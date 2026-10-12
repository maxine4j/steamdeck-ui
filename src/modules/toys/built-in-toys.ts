import type { ICollectionsClient } from "../../clients/collections-client";

export interface IBuiltInToys {
	disable(): void;
	restore(): void;
	isOpen(): boolean;
}
export class BuiltInToys implements IBuiltInToys {
	constructor(private readonly client: ICollectionsClient) {}
	disable(): void {
		this.client.disable("toys");
	}
	restore(): void {
		this.client.restore("toys");
	}
	isOpen(): boolean {
		return this.client.isOpen("toys");
	}
	close(): void {
		this.client.close();
	}
}
