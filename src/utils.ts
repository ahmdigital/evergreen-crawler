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


/**
 * retry retries an function up to maxAttempts times.
 * If maxAttempts is exceed, a list containing all thrown errors will be returned
 */
export async function retry<T>(f:()=>Promise<T>, maxAttempts:number):Promise<T>{

	if (maxAttempts > 3){
		console.warn(`Wait time for retrying will be up to: ${Math.pow(10, maxAttempts)} milliseconds`)
	}

	const errors:Error[] = []

	for (let i = 0; i < maxAttempts; i ++){
		try {
			return await f()
		}catch(e){
			// i < maxAttempts - 1 && console.warn("Retrying a failed request")
			// console.warn(e.errors.message)
			if(e instanceof Error){
				errors.push(e)
			} else{
				console.log("Error of unknown type in retry:")
				console.log(e)
				errors.push(new Error())
			}
			await sleep(Math.pow(10, i + 1))
		}
	}

	throw errors
}

export type Configuration = {
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
