import type { Frame } from "./frame";

declare const NOT_COLLECTED: string;

export interface PetTooltipContent {
	readonly id: string;
	readonly name: string;
	readonly collected: boolean;
	readonly source?: string;
	readonly description?: string;
}
/** Plain links/IDs include equipped comparisons; wrapped items show details only. */
export type TooltipContent =
	| string
	| number
	| { readonly text: string; readonly anchor?: Frame }
	| { readonly toy: number }
	| { readonly mountSpell: number }
	| { readonly spell: number }
	| { readonly pet: PetTooltipContent }
	| { readonly item: string | number };

export interface TooltipDataFrame {
	SetText(
		text: string,
		red?: number,
		green?: number,
		blue?: number,
		alpha?: number,
		wrap?: boolean,
	): void;
	SetHyperlink(link: string): void;
	SetToyByItemID(id: number): boolean;
	SetMountBySpellID(spell: number): void;
	SetCompanionPet(guid: string): void;
	AddLine(
		text: string,
		red: number,
		green: number,
		blue: number,
		wrap: boolean,
	): void;
}

export function setTooltipContent(
	frame: TooltipDataFrame,
	content: TooltipContent,
): void {
	if (typeof content === "object" && "spell" in content) {
		frame.SetHyperlink(`spell:${content.spell}`);
		return;
	}
	if (typeof content === "object" && "pet" in content) {
		const pet = content.pet;
		if (pet.collected) frame.SetCompanionPet(pet.id);
		else {
			frame.SetText(pet.name);
			if (pet.description) frame.AddLine(pet.description, 1, 1, 1, true);
		}
		if (pet.source) frame.AddLine(pet.source, 1, 1, 1, true);
		if (!pet.collected) frame.AddLine(NOT_COLLECTED, 1, 0.82, 0, true);
		return;
	}
	if (typeof content === "object" && "text" in content) {
		frame.SetText(content.text, 1, 1, 1, 1, true);
		return;
	}
	if (typeof content === "object" && "toy" in content) {
		frame.SetToyByItemID(content.toy);
		return;
	}
	if (typeof content === "object" && "mountSpell" in content) {
		frame.SetMountBySpellID(content.mountSpell);
		return;
	}
	const item = typeof content === "object" ? content.item : content;
	frame.SetHyperlink(typeof item === "number" ? `item:${item}` : item);
}
