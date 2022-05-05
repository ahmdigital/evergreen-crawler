import { Repository, getDependenciesNpm } from "./packageAPI";

export function depDataToJson(
	nameMap: Map<string, number>,
	data: Map<
		number,
		{ version: string; link: string; internal: boolean; archived: boolean }
	>
): string {
	let res = "";

	res += "{";

	for (const [name, id] of nameMap) {
		const thisData = data.get(id);
		res += '"' + id.toString() + '": {';
		res += '"name": "' + name + '",';
		res += '"version": "' + thisData.version + '",';
		res += '"link": "' + thisData.link + '",';
		res += '"internal": ' + thisData.internal + ",";
		res += '"archived": ' + thisData.archived + "";
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

	let depData: Map<
		number,
		{ version: string; link: string; internal: boolean; archived: boolean }
	> = new Map();

	for (const [name, data] of depMap) {
		const id = depNameMap.size;
		depNameMap.set(name, id);
		depData.set(id, {
			version: data.version,
			link: "",
			internal: false,
			archived: false,
		});
	}
	let repos: any[] = [];

	for (const d of data) {
		if (!depNameMap.has(d.name)) {
			depNameMap.set(d.name, depNameMap.size);
			depData.set(depNameMap.get(d.name), {
				version: d.version ? d.version : "",
				link: d.link,
				internal: true,
				archived: d.isArchived,
			});
		} else {
			depData.get(depNameMap.get(d.name)).link = d.link;
			depData.get(depNameMap.get(d.name)).internal = true;
		}

		let deps = [];

		for (const [depName, depVersion]  of d.dependencies) {
			if (!depNameMap.has(depName)) {
				depNameMap.set(depName, depNameMap.size);
				depData.set(depNameMap.get(depName), {
					version: "",
					link: "",
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

	console.log(depNameMap);
	console.log(depData);

	console.log(depDataToJson(depNameMap, depData));

	return repos;
}