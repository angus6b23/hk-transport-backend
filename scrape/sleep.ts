export default function sleep(ms = 10000): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}