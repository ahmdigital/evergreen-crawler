import * as fs from "fs";
import * as inquier from "inquirer";

/**
 * Read the token from the ".env" file.
 * @returns return the token
 */
export function getAccessToken(): string {
	try {
		return fs.readFileSync(".env").toString().trim();
	} catch (e) {
		throw new Error("Could not read token from .env file")
	}
}

export async function sleep(millis: number) {
	return new Promise(resolve => setTimeout(resolve, millis));
}
