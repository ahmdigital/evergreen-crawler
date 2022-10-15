import * as fs from "fs";
import path from "path";
import { error } from "./index"

/**
 * Read the token from the ".env" file.
 * @returns return the token
 */
export function getAccessToken(): string {
	require('dotenv').config();
	try {
		return process.env.GH_TOKEN!.toString().trim()
	} catch (e) {
		const msg = "Could not read token from env variables"
		error.msg = msg
		throw new Error(msg)
	}
}

export type Configuration = {
	targetOrganisation: string,
	npmURL?: string,
	pipURL?: string,
	rubygemsURL?: string
}

//Loads the configuration file "config.json"
export function loadConfig(): Configuration {
	try {
		return JSON.parse(fs.readFileSync("./config.json", "utf-8")) as Configuration;
	} catch (e) {
		const msg = "config.json file not found"
		error.msg = msg
		throw new Error(msg)
	}
}
export function readFile(filename: string): any {
	try {
		return fs.readFileSync(path.resolve(process.env.DYNAMIC_CACHE_DIR ?? "", filename), "utf-8") as any;
	} catch (e) {
		throw new Error(`cannot read file ${filename}: ${e}`)
	}
}

export function writeFile(filename: string, data: string) {
	try {
		fs.writeFileSync(path.resolve(process.env.DYNAMIC_CACHE_DIR ?? "", filename), data)
	} catch (e) {
		throw new Error(`Could not write to file ${filename}: ${e}`)
	}
}

export async function sleep(millis: number) {
	return new Promise(resolve => setTimeout(resolve, millis));
}

export function objectToMap(allDepsJSON: any) {
	let allDepsMap = new Map<string, any>()

	for (const [key, value] of Object.entries(allDepsJSON)) {
		allDepsMap.set(key, value)
	}
	return allDepsMap
}

export function mapToObject(map: Map<string, any>) {
	var obj: { [k: string]: any } = {};
	for (const [key, value] of map) {
		obj[key] = value
	}
	return obj
}
