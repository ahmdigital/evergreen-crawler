import { Repository, getDependenciesNpm } from "./packageAPI";

export type IdDepMap = Map<
	number,
	{ oldName: string, version: string; lastUpdated: string; link: string; languageVersion: string|undefined, internal: boolean; archived: boolean }
>

export type NameIdMap = Map<string, number>

export function depDataToJson(
	nameMap: NameIdMap,
	data: IdDepMap
): string {
	let res = "";

	res += "{";

	for (const [name, id] of nameMap) {
		const thisData = data.get(id);
		res += '"' + id.toString() + '": {';
		res += '"name": "' + name + '",';
		res += '"oldName": "' + thisData?.oldName + '",';
		res += '"version": "' + thisData?.version + '",';
		res += '"languageVersion": "' + thisData?.languageVersion + '",';
		res += '"lastUpdated": "' + thisData?.lastUpdated + '",';
		res += '"link": "' + thisData?.link + '",';
		res += '"internal": ' + thisData?.internal + ",";
		res += '"archived": ' + thisData?.archived + "";
		res += "}, ";
	}

	//Remove extra comma, as trailing commas aren't allowed in JSON
	if (res.length > 2) {
		res = res.slice(0, -2);
	}

	res += "}";

	return res;
}

export function generateDependencyTree(
	data: Repository[],
	depMap: Awaited<ReturnType<typeof getDependenciesNpm>>
): any {
	let depNameMap: Map<string, number> = new Map();

	let depData: IdDepMap = new Map();

	for (const [name, data] of depMap) {
		const id = depNameMap.size;
		depNameMap.set(name, id);
		depData.set(id, {
			oldName: "",
			version: data.version,
			lastUpdated: "",
			link: data.link,
			languageVersion: data.languageVersion,
			internal: false,
			archived: false,
		});
	}
	let repos: any[] = [];

	for (const d of data) {
		if (!depNameMap.has(d.name)) {
			depNameMap.set(d.name, depNameMap.size);
			depData.set(depNameMap.get(d.name) as number, {
				oldName: d.oldName,
				version: d.version ? d.version : "",
				lastUpdated: d.lastUpdated,
				link: d.link,
				languageVersion: d.languageVersion,
				internal: true,
				archived: d.isArchived,
			});
		} else {
			depData.get(depNameMap.get(d!.name)!)!.link = d!.link;
			depData.get(depNameMap.get(d!.name)!)!.lastUpdated = d!.lastUpdated;
			depData.get(depNameMap.get(d!.name)!)!.internal = true;
		}

		let deps = [];

		for (const [depName, depVersion]  of d.dependencies) {
			if (!depNameMap.has(depName)) {
				depNameMap.set(depName, depNameMap.size);
				depData.set(depNameMap.get(depName)!, {
					oldName: "",
					version: "",
					lastUpdated: "",
					link: "",
					languageVersion: undefined,
					internal: false,
					archived: false,
				});
			}
			deps.push([depNameMap.get(depName), depVersion]);
		}

		repos.push({
			dep: depNameMap.get(d.name),
			dependencies: deps,
		});
	}

	return depDataToJson(depNameMap, depData) + "," + JSON.stringify(repos);
}
