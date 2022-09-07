import * as fs from "fs";

/**
 * Read the token from the ".env" file.
 * @returns return the token
 */
export function getAccessToken(): string {
	require('dotenv').config();
	try {
		return process.env.GH_TOKEN!.toString().trim()
	} catch (e) {
		throw new Error("Could not read token from env variables")
	}
}

export type Configuration = {
	targetOrganisation: string,
	npmURL?: string,
	pipURL?: string,
	rubygemsURL?: string
}

//Loads the configuration file "config.json"
export function loadConfig(): Configuration{
	try {
		return JSON.parse(fs.readFileSync("./config.json", "utf-8")) as Configuration;
	} catch(e){
		throw new Error("config.json file not found")
	}
}
export function readFile(filename: string): any {
	try {
		return fs.readFileSync(filename, "utf-8") as any;
	} catch(e){
		throw new Error(`cannot read file ${filename}`)
	}
}

export function writeFile(filename: string, data: string){
	try{
		fs.writeFileSync(filename, data)
	} catch(e){
		throw new Error("Could not write to file " + filename)
	}
}

export async function sleep(millis: number) {
	return new Promise(resolve => setTimeout(resolve, millis));
}
