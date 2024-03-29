import { depDataToJson, generateDependencyTree, IdDepMap, NameIdMap } from "./outputData";
import { Repository } from "./packageAPI";

test("Test dependency list JSON", async () => {
	let depNameMap: NameIdMap = new Map();
	let depData: IdDepMap = new Map();

	depNameMap.set("x", 1);
	depData.set(1, {version: "1.2.3", link: "www.x.com", lastUpdated: "", internal: true, archived: false, oldName: "#x", languageVersion: "12"})
	depNameMap.set("y", 2);
	depData.set(2, {version: "21.9.03", link: "www.y.com", lastUpdated: "", internal: true, archived: false, oldName: "#y", languageVersion: "14"})
	depNameMap.set("z", 3);
	depData.set(3, {version: "7.3.32", link: "www.z.com", lastUpdated: "", internal: false, archived: false, oldName: undefined, languageVersion: undefined})
	depNameMap.set("12", 4);
	depData.set(4, {version: "4.2.1", link: "www.12.com", lastUpdated: "", internal: true, archived: true, oldName: "#12", languageVersion: "12"})
	depNameMap.set("#&,", 5);
	depData.set(5, {version: "1.4.5", link: "www.%23%26%2C.com", lastUpdated: "", internal: true, archived: false, oldName: "#&", languageVersion: "16"})
	depNameMap.set("w", 6);
	depData.set(6, {version: "8.4.19", link: "www.w.com", lastUpdated: "", internal: false, archived: true, oldName: undefined, languageVersion: undefined})

	const res = JSON.parse(depDataToJson(depNameMap, depData))

	console.log(res)

	const expected = {
		"1": { name: "x", version: "1.2.3", link: "www.x.com", lastUpdated: "", internal: true, archived: false, oldName: "#x", languageVersion: "12"},
		"2": { name: "y", version: "21.9.03", link: "www.y.com", lastUpdated: "", internal: true, archived: false, oldName: "#y", languageVersion: "14"},
		"3": { name: "z", version: "7.3.32", link: "www.z.com", lastUpdated: "", internal: false, archived: false},
		"4": { name: "12", version: "4.2.1", link: "www.12.com",  lastUpdated: "", internal: true, archived: true, oldName: "#12", languageVersion: "12"},
		"5": { name: "#&,", version: "1.4.5", link: "www.%23%26%2C.com", lastUpdated: "", internal: true, archived: false, oldName: "#&", languageVersion: "16"},
		"6": { name: "w", version: "8.4.19",  link: "www.w.com",  lastUpdated: "", internal: false,  archived: true}
	}

	expect(res).toStrictEqual(expected)
})

test("Test dependency map JSON", async () => {
	let reps: Repository[] = [
		{
			name: "x",
			oldName: "#x.js",
			version: "1.2.3.4",
			link: "www.x.com",
			lastUpdated: "", 
			isArchived: false,
			dependencies: new Map<string, string>([["y", "1.2.3"], ["z", "4.1.3"], ["w", "9.19.1"]])
		},{
			name: "y",
			oldName: "#y.js",
			version: "5.2.3",
			link: "www.y.com",
			lastUpdated: "", 
			isArchived: false,
			dependencies: new Map<string, string>([["z", "4.1.2"]])
		},{
			name: "z",
			oldName: "#z.js",
			version: "4.2.4",
			link: "www.z.com",
			lastUpdated: "", 
			isArchived: false,
			dependencies: new Map<string, string>([["w", "9.19.1"]])
		}
	]

	let deps: Map<string, {version: string, link: string}> = new Map([["w", {version: "9.20.4", link: "www.w.com"}]]);

	const res = JSON.parse("{ \"data\": [" + generateDependencyTree(reps, deps) + "]}")

	console.log(res.toString())

	const expected = {
		"data": [
			{
				"0": { "archived": false, "internal": false, "link": "www.w.com", "lastUpdated": "", "name": "w", "version": "9.20.4"},
				"1": {"archived": false, "internal": true, "link": "www.x.com", "lastUpdated": "", "name": "x", "oldName": "#x.js", "version": "1.2.3.4"},
				"2": {"archived": false, "internal": true, "link": "www.y.com", "lastUpdated": "", "name": "y", "oldName": "#y.js", "version": ""},
				"3": {"archived": false, "internal": true, "link": "www.z.com", "lastUpdated": "", "name": "z", "oldName": "#z.js", "version": ""},
			}, [
				{ "dep": 1, "dependencies":  [[2, "1.2.3"], [3, "4.1.3"], [0, "9.19.1" ]]},
				{ "dep": 2, "dependencies":  [[ 3, "4.1.2" ]], },
				{ "dep": 3, "dependencies":  [[0, "9.19.1" ]], },
			],
		],
	}

	expect(res).toStrictEqual(expected)
})
