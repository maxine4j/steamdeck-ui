export const RADIAL_DEADZONE = 0.5;

/** One-based, clockwise sectors with the first item at twelve o'clock. */
export function radialIndex(
	x: number,
	y: number,
	length: number,
	count: number,
): number | undefined {
	if (length < RADIAL_DEADZONE || count === 0) return undefined;
	const turn = Math.PI * 2;
	const angle = (Math.atan2(x, y) + turn) % turn;
	return (Math.floor((angle * count) / turn + 0.5) % count) + 1;
}

// The secure commit uses the same sector calculation as the visual highlight.
export const RADIAL_INDEX_SNIPPET = `
if len and len >= ${RADIAL_DEADZONE} and count > 0 then
	local angle = (math.atan2(x, y) + math.pi * 2) % (math.pi * 2)
	index = (math.floor(angle * count / (math.pi * 2) + 0.5) % count) + 1
end`;
