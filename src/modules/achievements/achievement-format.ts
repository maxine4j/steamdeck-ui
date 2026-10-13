export function formatAchievementNumber(value: number): string {
	let digits = `${Math.floor(Math.abs(value))}`;
	const groups: string[] = [];
	while (digits.length > 3) {
		groups.unshift(digits.slice(-3));
		digits = digits.slice(0, -3);
	}
	groups.unshift(digits);
	return `${value < 0 ? "−" : ""}${groups.join(",")}`;
}
export function formatAchievementProgress(
	completed: number,
	total: number,
	unit = "",
): string {
	return `${formatAchievementNumber(completed)} / ${formatAchievementNumber(total)}${unit !== "" ? ` ${unit}` : ""} • ${total > 0 ? Math.round((completed / total) * 100) : 0}%`;
}
