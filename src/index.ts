import { TokenBucket } from "./rate-limiting/token-bucket";
import { getAccessToken, loadConfig, writeFile, Configuration, retry, readFile, objectToMap } from "./utils";
import { auxData, generateDependencyTree } from "./outputData";
import { getDependenciesNpm, getDependenciesPyPI, Repository, APIParameters, PackageRateLimiter, getDependenciesRubyGems, packageManagerFiles } from "./packageAPI";
import { DependencyGraphDependency, GraphResponse, OrgRepos, RepoEdge, BranchManifest, UpperBranchManifest, queryDependencies, queryRepositories, queryRepoManifest, RepoManifest, queryRepoManifestRest } from "./graphQLAPI"

export const scrapeOrgCacheFilename = "scrapeOrganisationCache.json";

// This type will be used to keep track of when was the last time the repository was updated
// so that it can be used to skip crawling repository all together
type LastTimeUpdated = {
	[repoName: string]: {
		lastUpdated: string,
		deps?: ReturnType<typeof getRepoDependencies>,
		manifests: {
			[path: string]: {
				name: string,
				version: string,
				languageVersion: string
			}
		}
	};
}

//Used to send an error message to the frontend - do no put private inforamtion here
export let error: {msg: string | undefined} = {msg: undefined}

// returns list of repo objects
function getRepos(response: GraphResponse) {
	const allRepos: RepoEdge[] = response?.organization?.repositories?.edges;
	let filteredRepos: BranchManifest[] = []
	for (const repo of allRepos) {
		//console.log(repo);
		const ref = repo.node
		if (ref == null) {
			continue
		}

		filteredRepos.push(ref)
	}
	return filteredRepos
}

async function getRealNames(repoList: ReturnType<typeof getAllRepoDeps>, targetOrganisation: string, accessToken: string, tokenBucket: TokenBucket, lastTimeUpdated: LastTimeUpdated) {
	for (const repo of repoList) {
		let pathStrings: string[] = []
		for (const [packageManager, depList] of Object.entries(repo.packageMap)) {
			if (packageManager == "RUBYGEMS") { continue }
			for (const subRepo of depList) {
				pathStrings.push(subRepo.subPath)
			}
		}

		let realDataPromises: any[] = []
		const orgName = targetOrganisation
		const repoName = repo.manifest.name
		console.log("Trying to query repo: " + repoName)

		for (let i = 0; i < pathStrings.length; i += 1) {
			if (lastTimeUpdated?.[repoName]?.manifests?.[pathStrings[i]] !== undefined && Date.parse(lastTimeUpdated[repoName].lastUpdated) >= Date.parse(repo.manifest.pushedAt)) {
				realDataPromises.push(
					new Promise<{ name: string, version: string, languageVersion: string }>((resolve) => resolve(lastTimeUpdated[repoName].manifests[pathStrings[i]]))
				)
			}
			else {
				realDataPromises.push(queryRepoManifestRest(orgName, repoName, pathStrings[i], accessToken, tokenBucket)
					.then(content => {
						const packageRealName = {
							name: content?.name || "",
							version: content?.version || "",
							languageVersion: content?.engines.node || undefined
						}
						lastTimeUpdated[repoName].manifests[pathStrings[i]] = packageRealName
						return packageRealName
					})
				)
			}
		}

		await Promise.allSettled(realDataPromises)
		const realData: { name: string, version: string, languageVersion?: string }[] = []
		for (const d of realDataPromises) {
			realData.push(await d.then(
				(params: any) => ({ name: params.name, version: params.version, languageVersion: params.languageVersion }),
				(_: any) => ({ name: "", version: "", languageVersion: undefined })
			))
		}

		let i = 0
		for (const [packageManager, depList] of Object.entries(repo.packageMap)) {
			if (packageManager == "RUBYGEMS") {
				for (const subRepo of depList) {
					//TODO: Get name from the X.gemspec file in the same repo, as X is the name we need
				}
			} else {
				for (const subRepo of depList) {
					try {
						subRepo.realName = realData[i].name
						subRepo.version = realData[i].version
						subRepo.languageVersion = realData[i].languageVersion
					} catch {
						console.log(realData)
						console.log(i)
					}
					i++
				}
			}
		}
	}
}

// get dependencies of a repo obj, used by function getAllRepoDeps(repoList)
// returns object with repo name and list of blob paths ending with package.json and blob path's dependencies
function getRepoDependencies(repo: BranchManifest) {
	type PackageData = {
		subPath: string,
		subPathName: string,
		blobPath: string,
		version: string,
		languageVersion?: string,
		pushedAt: string,
		dependencies: DependencyGraphDependency[],
		realName: string
	}

	function blobPathDeps(subPath: string, subPathName: string, blobPath: string, pushedAt: string, deps: DependencyGraphDependency[]): PackageData {
		return { subPath: subPath, subPathName: subPathName, blobPath: blobPath, version: "", languageVersion: undefined, pushedAt: pushedAt, dependencies: deps, realName: ""}
	}

	type packageMap = {
		[packageManager: string]: ReturnType<typeof blobPathDeps>[]
	  }
	let repoDepObj: {
		manifest: UpperBranchManifest, packageMap: packageMap
	} = { manifest: repo as UpperBranchManifest, packageMap: {} }

	// repoDepObj.packageMap = new Map()

	const depGraphManifests = repo.dependencyGraphManifests
	const files = depGraphManifests.edges
	let index = 0

	const repoUpdateTime = repo.pushedAt

	// iterate through all files in repo to find the ones with package.json
	for (const file of files) {
		const blobPath = file.node.blobPath;

		const subPath = depGraphManifests.edges[index].node.filename
		index += 1;
		for (const packageManager of packageManagerFiles) {
			for (const ext of packageManager.extensions) {
				// check path ends with extension
				if (subPath.endsWith(ext)) {
					const subPathName = subPath.replace(ext, "")
					console.log(blobPath + ", " + subPathName + ext)
					const depCount = file.node.dependencies.totalCount

					if (!repoDepObj.packageMap[packageManager.name]) {
						repoDepObj.packageMap[packageManager.name] = []
					}

					if (depCount > 0) {
						const dependencies = file.node.dependencies.nodes
						const blobPathDep = blobPathDeps(subPath, subPathName, blobPath, repoUpdateTime, dependencies)
						repoDepObj.packageMap[packageManager.name]?.push(blobPathDep)
					} else {
						// currently includes package.json files with no dependencies
						const blobPathDep = blobPathDeps(subPath, subPathName, blobPath, repoUpdateTime, [])
						repoDepObj.packageMap[packageManager.name]?.push(blobPathDep)
					}
				}
			}
		}
	}
	return repoDepObj
}

// get dependencies of all repos in repoList, repolist: list of repo objects
// repoList generated by getPkgJSONRepos()
function getAllRepoDeps(repoList: BranchManifest[], lastTimeUpdated: LastTimeUpdated) {
	let all_dependencies: ReturnType<typeof getRepoDependencies>[] = []
	for (const repo of repoList) {
		if ( lastTimeUpdated[repo.name] && Date.parse(lastTimeUpdated[repo.name].lastUpdated) >= Date.parse(repo.pushedAt)) {
			if (lastTimeUpdated[repo.name]?.deps){
				all_dependencies.push(lastTimeUpdated[repo.name].deps!)
			}
			else{
				continue
			}
		}
		else{
			const deps = getRepoDependencies(repo)
			if (Object.keys(deps.packageMap).length > 0) {
				all_dependencies.push(deps)
				lastTimeUpdated[repo.name] = {lastUpdated: repo.pushedAt, deps: deps, manifests: {}}
			}
		}
	}
	return all_dependencies
}

export function mergeDependenciesLists(managerRepos: Map<string, Repository[]>): Map<string, string[]> {
	let deps: Map<string, Set<string>> = new Map()

	for (const [packageManager, repos] of managerRepos) {
		//console.log(packageManager)
		for (const repo of repos) {
			for (const [name, version] of repo.dependencies) {
				//console.log("\t" + name)
				if (!deps.has(packageManager)) { deps.set(packageManager, new Set()) }
				deps.get(packageManager)?.add(name);
			}
		}
	}

	let managerDeps: Map<string, string[]> = new Map()

	for (const [key, value] of deps) {
		managerDeps.set(key, Array.from(value.values()))
	}

	return managerDeps
}

//The minimum amount of github points needed in order to scrape an Organisation
//Note: This value is just a guess.
const MINIMUM_GITHUB_POINTS = 10;

/**
 * This function performs pre-flight requests to retrieve a list of cursors to be used in \\TODO: insert function name here
 * !NOTE: the output will be saved inside the input repoCursors[] list. This allows us to continue from the last cursor in case of a crash.
 */
async function getOrgReposCursors(targetOrganisation: string, repoCursors:(string | null)[], accessToken: string): Promise<(string | null)[]> {

	const numOfPages = 100
	let hasNextPage = false;
	// let repoCursor = null;

	do {
		let lastCursor: string | null = null
		// the last cursor in a call is always equivalent to endCursor, so we can use it for the next calls
		if (repoCursors.length !== 0) {
			lastCursor = repoCursors[repoCursors.length - 1]
		}


		const response = await queryRepositories(targetOrganisation, numOfPages, lastCursor, accessToken) as OrgRepos;

		for (const repo of response.organization.repositories.edges) {
			// TODO: yield repo.cursor
			repoCursors.push(repo.cursor);
		}

		hasNextPage = response?.organization?.repositories?.pageInfo?.hasNextPage;
		// if (hasNextPage) {
		// 	repoCursor = response?.organization?.repositories?.pageInfo?.endCursor;

		// }

		const remaining = response.rateLimit.remaining;
		const resetDate = new Date(response.rateLimit.resetAt);

		if (remaining < MINIMUM_GITHUB_POINTS) {
			// use absolute, because the are cases in which the reset date could be behind current date (now)
			const diff_seconds = Math.abs(resetDate.getTime() - Date.now()) / (1000);

			throw new Error(`Rate limit reached. Waiting ${diff_seconds} seconds.`);
		}

	} while (hasNextPage);
	return repoCursors;
}

/**
 * This function fetches repositories and implements the proper error handling and retry logic.
 */
async function fetchingData(targetOrganisation: string, accessToken:string ): Promise<{responses: GraphResponse[], failedCursors: (string | null)[]}>  {
	let repoCursors: (string | null)[] = [];
	const promises: Promise<void>[] = [];
	try {

		await retry(() => getOrgReposCursors(targetOrganisation, repoCursors, accessToken), 3);
		// prepend a null so that we can get the first repo, and remove the last cursor
		// this is because we always get x repos after y cursor, if the cursor is null, then it start getting the first repos
		let requestRepoCursors: (string | null)[] = (repoCursors.slice(0, -1))
		requestRepoCursors.unshift(null)
		const numOfPages = 1;
		const responses: GraphResponse[] = [];

		const failedCursors: (string | null)[] = [];

		for (let curCursor = 0; curCursor < requestRepoCursors.length; curCursor += numOfPages) {

			promises.push(new Promise(async (resolve, reject) => {
				try {
					// get numOfPages repositories at a time
					const res = await retry(() => queryDependencies(targetOrganisation, numOfPages, requestRepoCursors[curCursor], accessToken) as Promise<GraphResponse>, 2);
					responses.push(res);
				} catch (e) {
					const cursors = requestRepoCursors.slice(curCursor, curCursor + numOfPages);
					if (numOfPages === 1){
						failedCursors.push(...cursors);
					}
					else{
						// if there's a failure, get each repository individually
						try {
							const subPromises = cursors.map(c => retry(() => queryDependencies(targetOrganisation, 1, c, accessToken) as Promise<GraphResponse>, 3));
							const res = await Promise.all(subPromises);
							responses.push(...res);
						} catch (eSub) {
							//reject(new Error(`Unable to fetch single repositories due to ${eSub},\nwhich was caused by ${e}`))
							//we don't want to reject, we want to keep partial responses
							failedCursors.push(...cursors);
						}
					}
				}
				resolve();
			}));
		}

		await Promise.all(promises);

		if (failedCursors.length === promises.length) {
			throw new Error("Couldn't fetch any repo :(");
		}
		else if (failedCursors.length > 0) {
			let msg = `Failed to retrieve ${failedCursors.length} cursors out of ${promises.length} cursors.\nfailed cursors : ${failedCursors}`
			console.warn(msg);
			error.msg = msg
		}

		return {responses, failedCursors}


	} catch (e) {
		throw new Error(`Nothing we can do about this :( ${e}`);
	}
}


export async function scrapeOrganisation(targetOrganisation: string, accessToken: string, useCachedData: boolean = true) {
	let allDeps = new Map<string, Repository[]>()
	if(useCachedData){
		console.log("Using cached data")
		try {

			let allDeps = objectToMap(JSON.parse(readFile(scrapeOrgCacheFilename))) as Map<string, any>
			for(let [key, value] of allDeps){
				for(let dep of value){
					dep.dependencies = objectToMap(dep.dependencies) as Map<string, string>
				}
			}

			return allDeps
		} catch (error) {
			console.log(`Couldn't load scrapeOrganisationCache cached file: ${error}`)
		}
	}

	const {responses, failedCursors} = await fetchingData(targetOrganisation, accessToken);

	console.log("Fetched all repositories cursors");
	// const responses = await Promise.all(promises);

	const tokenBucket = new TokenBucket(1000, 60.0/60.0, 1)

	let lastTimeUpdated: LastTimeUpdated;
	try {
		// TODO: use .json() and maybe reuse scrapeOrganisationCache.json instead of creating a new one
		// Load previous github crawl, so that it can be used to skip some of the crawling
		lastTimeUpdated = JSON.parse(readFile(`${targetOrganisation}-github-org-cache.json`)) as LastTimeUpdated
	} catch (error) {
		console.log(`Couldn't load github organisation cached file ${error}`)
		lastTimeUpdated = {}
	}

	for (const response of responses) {

		for (const repo of response?.organization?.repositories?.edges) {
			const ref = repo.node?.dependencyGraphManifests;
			if (ref == null) {
				continue
			}

			const files: any[] = repo.node!.dependencyGraphManifests!.edges;
			console.log(repo.node!.name)

			//This requires files to be sorted by depth, shallowest first
			for (const file of files) {
				const blobPath = file.node.blobPath;
				console.log(blobPath)
			}
		}

		const repoList = getRepos(response);

		const allRepoDeps = getAllRepoDeps(repoList, lastTimeUpdated);
		console.log("finished getting repoList")

		//TODO: should only query required type manifests, it should not query Rupygem or PYPI dependencies
		await getRealNames(allRepoDeps, targetOrganisation, accessToken, tokenBucket, lastTimeUpdated);

		for (const repo of allRepoDeps) {
			const name = repo.manifest.name

			for (const [packageManager, depList] of Object.entries(repo.packageMap)) {
				for (const subRepo of depList) {
					let deps: Map<string, string> = new Map();

					for (const dep of subRepo.dependencies) {
						deps.set(dep.packageName, dep.requirements)
					}

					let rep: Repository = {
						name: subRepo.realName,
						oldName: name + (subRepo.subPath == "" ? "" : "(" + subRepo.subPath + ")"),
						version: subRepo.version,
						lastUpdated: subRepo.pushedAt, //lastUpdated represents the date and time of the last commit
						link: repo.manifest.url,
						languageVersion: subRepo.languageVersion,
						isArchived: repo.manifest.isArchived,
						dependencies: deps
					}

					//TODO: When we fix getting the real names, remove this
					rep.name = rep.name == "" ? rep.oldName : rep.name;

					if (!allDeps.has(packageManager)) {
						allDeps.set(packageManager, [])
					}
					allDeps.get(packageManager)?.push(rep)
				}
			}
		}
	}

	writeFile(`${targetOrganisation}-github-org-cache.json`, JSON.stringify(lastTimeUpdated));
	return allDeps
}

export async function getJsonStructure(accessToken: string, targetOrganisation: string ,config: Configuration,
	{ toUse = ["NPM"], crawlStart = null, useCachedData = true }:
		{ toUse?: string[] , crawlStart?: string | null, useCachedData?: boolean } = {}) {

	const startTime = Date.now();

	console.log(targetOrganisation)
	console.log("Configuration:")
	console.log(config)

	let rateLimiter: PackageRateLimiter = {
		npm: { tokenBucket: new TokenBucket(1000, APIParameters.npm.rateLimit, APIParameters.npm.intialTokens) },
		pypi: { tokenBucket: new TokenBucket(1000, APIParameters.pypi.rateLimit, APIParameters.pypi.intialTokens) },
		rubygems: { tokenBucket: new TokenBucket(1000, APIParameters.rubygems.rateLimit, APIParameters.rubygems.intialTokens) },
	};

	crawlStart = crawlStart ?? startTime.toString()

	// ==== START: Extracting dependencies from Github graphql response === //

	const allDeps = await scrapeOrganisation(targetOrganisation, accessToken, useCachedData)
	console.log("Total time scraping " + targetOrganisation + ":" + ((Date.now() - startTime) / 1000).toString())

	// allDeps: list of dependencies to be given to package APIs
	const packageDeps = mergeDependenciesLists(allDeps);

	let depDataMap: Map<string, Map<string, {version: string, link: string}>> = new Map()
	let startTimeRegistry = Date.now();
	if (toUse.includes("NPM") && packageDeps.has("NPM")) {
		console.error("Total number of NPM  dependencies " + packageDeps.get("NPM")?.length)
		depDataMap.set("NPM", await getDependenciesNpm(packageDeps.get("NPM") as string[], rateLimiter, config))
		console.error("Total time NPM " + targetOrganisation + ":" + ((Date.now() - startTimeRegistry) / 1000).toString())
	}
	if (toUse.includes("PYPI") && packageDeps.has("PYPI")) {
		console.error("Total number of PYPI  dependencies " + packageDeps.get("PYPI")?.length)
		startTimeRegistry = Date.now();
		depDataMap.set("PYPI", await getDependenciesPyPI(packageDeps.get("PYPI") as string[], rateLimiter, config))
		console.error("Total time PYPI " + targetOrganisation + ":" + ((Date.now() - startTimeRegistry) / 1000).toString())
	}
	if (toUse.includes("RUBYGEMS") && packageDeps.has("RUBYGEMS")) {
		console.error("Total number of RUBYGEMS  dependencies " + packageDeps.get("RUBYGEMS")?.length)
		startTimeRegistry = Date.now();
		depDataMap.set("RUBYGEMS", await getDependenciesRubyGems(packageDeps.get("RUBYGEMS") as string[], rateLimiter, config))
		console.error("Total time RUBYGEMS " + targetOrganisation + ":" + ((Date.now() - startTimeRegistry) / 1000).toString())
	}

	//Wait for all requests to finish
	console.log("Waiting for all requests to finish");
	await Promise.all([
		//rateLimiter.Github.tokenBucket.waitForShorterQueue(100),
		rateLimiter.npm.tokenBucket.waitForShorterQueue(100),
		rateLimiter.pypi.tokenBucket.waitForShorterQueue(100),
		rateLimiter.rubygems.tokenBucket.waitForShorterQueue(100),
	]);

	//Print the total time
	const endTime = Date.now();
	console.log("Total time: " + ((endTime - startTime) / 1000).toString())

	let jsonResult: string = ""

	jsonResult += "{"
	jsonResult += "\"aux\":"
	jsonResult += auxData(targetOrganisation, crawlStart, error.msg)
	jsonResult += ","
	jsonResult += "\"npm\": ["
	jsonResult += !(toUse.includes("NPM") && allDeps.has("NPM")) ? "" : generateDependencyTree(allDeps.get("NPM") as Repository[], depDataMap.get("NPM") as any)
	jsonResult += "],"
	jsonResult += "\"PyPI\": ["
	jsonResult += !(toUse.includes("PYPI") && allDeps.has("PYPI")) ? "" : generateDependencyTree(allDeps.get("PYPI") as Repository[], depDataMap.get("PYPI") as any)
	jsonResult += "],"
	jsonResult += "\"RubyGems\": ["
	jsonResult += !(toUse.includes("RUBYGEMS") && allDeps.has("RUBYGEMS")) ? "" : generateDependencyTree(allDeps.get("RUBYGEMS") as Repository[], depDataMap.get("RUBYGEMS") as any)
	jsonResult += "]"
	jsonResult += "}"

	return jsonResult
}

//Main function
async function main() {
	try{
		const accessToken = getAccessToken()
		const config = loadConfig()
		writeFile("cachedData.json", await getJsonStructure(accessToken, process.env.targetOrganisation!, config, {useCachedData: false}));
	} catch(e){
		const result = {
			aux: {
				crawlStart: Date.now().toString(),
				error: error.msg
			}
		}
		writeFile("cachedData.json", JSON.stringify(result))
		console.error(e)
	}
}

if (require.main === module) {
    console.log("Running standalone");
	main();
} else {
	//Being called as a module
}
