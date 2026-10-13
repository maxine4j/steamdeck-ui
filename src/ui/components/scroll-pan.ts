interface Pointer {
	readonly down: boolean;
	readonly over: boolean;
	readonly y: number;
	readonly scale: number;
}

/** Pointer panning state, shared by scroll viewports and their child controls. */
export class ScrollPan {
	private down = false;
	private active = false;
	private dragged = false;
	private startY = 0;
	private startOffset = 0;
	private previousY = 0;
	private velocity = 0;
	constructor(
		private readonly readPointer: (this: void) => Pointer,
		private readonly readScroll: (this: void) => {
			offset: number;
			range: number;
		},
		private readonly writeScroll: (this: void, offset: number) => void,
	) {}
	update(elapsed: number): void {
		const pointer = this.readPointer();
		const y = pointer.y / Math.max(0.001, pointer.scale);
		if (pointer.down && !this.down) {
			this.velocity = 0;
			this.dragged = false;
			this.active = pointer.over;
			this.startY = this.previousY = y;
			this.startOffset = this.readScroll().offset;
		}
		if (pointer.down && this.active) {
			const distance = y - this.startY;
			if (Math.abs(distance) >= 6) this.dragged = true;
			if (this.dragged) {
				this.move(this.startOffset + distance);
				if (elapsed > 0)
					this.velocity = Math.max(
						-2000,
						Math.min(2000, (y - this.previousY) / elapsed),
					);
			}
			this.previousY = y;
		} else if (!pointer.down && !this.down && Math.abs(this.velocity) > 5) {
			const dt = Math.min(0.05, elapsed);
			this.move(this.readScroll().offset + this.velocity * dt);
			this.velocity *= Math.exp(-8 * dt);
		}
		if (!pointer.down && !this.down && elapsed > 0) this.dragged = false;
		if (!pointer.down) this.active = false;
		this.down = pointer.down;
	}
	private move(target: number): void {
		const { range } = this.readScroll();
		const offset = Math.max(0, Math.min(range, target));
		this.writeScroll(offset);
		if (offset !== target) this.velocity = 0;
	}
	suppressClick(): boolean {
		// Sample before click dispatch so a release between render ticks still counts.
		if (this.down) this.update(0);
		return this.dragged;
	}
	reset(): void {
		this.active = false;
		this.dragged = false;
		this.velocity = 0;
	}
}
