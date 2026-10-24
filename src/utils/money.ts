export function commaNumber(value: number): string {
	const digits = `${Math.floor(value)}`;
	let result = "";
	for (let i = 0; i < digits.length; i++) {
		if (i > 0 && (digits.length - i) % 3 === 0) result += ",";
		result += digits.charAt(i);
	}
	return result;
}

export function formatMoney(copper: number, hideZero = false): string {
	return [
		{ count: Math.floor(copper / 10000), icon: "Gold" },
		{ count: Math.floor(copper / 100) % 100, icon: "Silver" },
		{ count: copper % 100, icon: "Copper" },
	]
		.filter((coin) => !hideZero || coin.count > 0)
		.map(
			(coin) =>
				`${commaNumber(coin.count)}|TInterface\\MoneyFrame\\UI-${coin.icon}Icon:14:14|t`,
		)
		.join("  ");
}
