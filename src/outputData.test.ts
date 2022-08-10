import { depDataToJson, generateDependencyTree, IdDepMap, NameIdMap } from "./outputData";
import { Repository } from "./packageAPI";

test("Test dependency list JSON", async () => {
	let depNameMap: NameIdMap = new Map();
	let depData: IdDepMap = new Map();

	depNameMap.set("x", 1);
	depData.set(1, {version: "1.2.3", link: "www.x.com", internal: true, archived: false})
	depNameMap.set("y", 2);
	depData.set(2, {version: "21.9.03", link: "www.y.com", internal: true, archived: false})
	depNameMap.set("z", 3);
	depData.set(3, {version: "7.3.32", link: "www.z.com", internal: false, archived: false})
	depNameMap.set("12", 4);
	depData.set(4, {version: "4.2.1", link: "www.12.com", internal: true, archived: true})
	depNameMap.set("#&,", 5);
	depData.set(5, {version: "1.4.5", link: "www.%23%26%2C.com", internal: true, archived: false})
	depNameMap.set("w", 6);
	depData.set(6, {version: "8.4.19", link: "www.w.com", internal: false, archived: true})

	const res = JSON.parse(depDataToJson(depNameMap, depData))

	console.log(res)

	const expected = {
		"1": { name: "x", version: "1.2.3", link: "www.x.com", internal: true, archived: false},
		"2": { name: "y", version: "21.9.03", link: "www.y.com", internal: true, archived: false},
		"3": { name: "z", version: "7.3.32", link: "www.z.com", internal: false, archived: false},
		"4": { name: "12", version: "4.2.1", link: "www.12.com",  internal: true, archived: true},
		"5": { name: "#&,", version: "1.4.5", link: "www.%23%26%2C.com", internal: true, archived: false},
		"6": { name: "w", version: "8.4.19",  link: "www.w.com",  internal: false,  archived: true}
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
			isArchived: false,
			dependencies: new Map<string, string>([["y", "1.2.3"], ["z", "4.1.3"], ["w", "9.19.1"]])
		},{
			name: "y",
			oldName: "#y.js",
			version: "5.2.3",
			link: "www.y.com",
			isArchived: false,
			dependencies: new Map<string, string>([["z", "4.1.2"]])
		},{
			name: "z",
			oldName: "#z.js",
			version: "4.2.4",
			link: "www.z.com",
			isArchived: false,
			dependencies: new Map<string, string>([["w", "9.19.1"]])
		}
	]

	let deps: Map<string, {version: string}> = new Map([["w", {version: "9.20.4"}]]);

	const res = JSON.parse("{ \"data\": [" + generateDependencyTree(reps, deps) + "]}")

	console.log(res.toString())

	const expected = {
		"data": [
			{
				"0": { "archived": false, "internal": false, "link": "", "name": "w", "version": "9.20.4"},
				"1": {"archived": false, "internal": true, "link": "www.x.com", "name": "x", "version": "1.2.3.4"},
				"2": {"archived": false, "internal": true, "link": "www.y.com", "name": "y", "version": ""},
				"3": {"archived": false, "internal": true, "link": "www.z.com", "name": "z", "version": ""},
			}, [
				{ "dep": 1, "dependencies":  [[2, "1.2.3"], [3, "4.1.3"], [0, "9.19.1" ]]},
				{ "dep": 2, "dependencies":  [[ 3, "4.1.2" ]], },
				{ "dep": 3, "dependencies":  [[0, "9.19.1" ]], },
			],
		],
	}

	expect(res).toStrictEqual(expected)
})
