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
		throw new Error(`cannot read file ${filename}: ${e}`)
	}
}

export function writeFile(filename: string, data: string){
	try{
		fs.writeFileSync(filename, data)
	} catch(e){
		throw new Error(`Could not write to file ${filename}: ${e}`)
	}
}

export async function sleep(millis: number) {
	return new Promise(resolve => setTimeout(resolve, millis));
}
// packageMap
export async function replacer(key: any, value: any) {
	if (key === "packageMap"){
		return value
	}
  if (value instanceof Map) {
    return {
      dataType: "Map",
      value: Array.from(value.entries()), // or with spread: value: [...value]
    };
  } else {
    return value.toString();
  }
}

// function stringifyMap(myMap:any ) {
//     function selfIterator(map: any) {
//         return Array.from(map).reduce((acc, [key, value]) => {
//             if (value instanceof Map) {
//                 acc[key] = selfIterator(value);
//             } else {
//                 acc[key] = value;
//             }

//             return acc;
//         }, {})
//     }

//     const res = selfIterator(myMap)
//     return JSON.stringify(res);
// }


export async function reviver(key: any, value: any) {
  if (typeof value === "object" && value !== null) {
    if (value.dataType === "Map") {
      return new Map(value.value);
    }
  }
  return value;
}
