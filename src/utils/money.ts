export function commaNumber(value: number): string {
	const digits = `${Math.floor(value)}`;
	let result = "";
	for (let i = 0; i < digits.length; i++) {
		if (i > 0 && (digits.length - i) % 3 === 0) result += ",";
		result += digits.charAt(i);
	}
	return result;
}

export function formatMoney(copper: number): string {
	return `${commaNumber(Math.floor(copper / 10000))}|TInterface\\MoneyFrame\\UI-GoldIcon:14:14|t  ${Math.floor(copper / 100) % 100}|TInterface\\MoneyFrame\\UI-SilverIcon:14:14|t  ${copper % 100}|TInterface\\MoneyFrame\\UI-CopperIcon:14:14|t`;
}
