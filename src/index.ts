import { TokenBucket } from "./rate-limiting/token-bucket";
import { getAccessToken, loadConfig, writeFile, Configuration, sleep } from "./utils";
import { generateDependencyTree } from "./outputData";
import { getDependenciesNpm, getDependenciesPyPI, Repository, APIParameters, PackageRateLimiter, getDependenciesRubyGems, packageManagerFiles } from "./packageAPI";
import { DependencyGraphDependency, GraphResponse, OrgRepos, RepoEdge, BranchManifest, UpperBranchManifest, queryDependencies, queryRepositories, queryRepoManifest, RepoManifest, queryRepoManifestRest } from "./graphQLAPI"

// returns list of repo objects
function getRepos(response: GraphResponse) {
	const allRepos: RepoEdge[] = response?.organization?.repositories?.edges;
	let filteredRepos: BranchManifest[] = []
	for (const repo of allRepos) {
		//console.log(repo);
		const ref = repo.node.mainBranch ? repo.node.mainBranch : repo.node.masterBranch;
		if (ref == null) {
			continue
		}

		filteredRepos.push(ref)
	}
	return filteredRepos
}

async function getRealNames(repoList: ReturnType<typeof getAllRepoDeps>, config: ReturnType<typeof loadConfig>, accessToken: string, tokenBucket: TokenBucket){
	for (const repo of repoList) {
		let pathStrings: string[] = []
		for (const [packageManager, depList] of repo.packageMap) {
			if(packageManager == "RUBYGEMS"){ continue }
			for (const subRepo of depList) {
				pathStrings.push(subRepo.subPath)
			}
		}

		let realDataPromises: any[] = []
		const branchName = repo.manifest.defaultBranchRef.name
		const orgName = config.targetOrganisation
		const repoName = repo.manifest.name
		console.log("Trying to query repo: " + repoName)

		for(let i = 0; i < pathStrings.length; i+=1){
			realDataPromises.push(queryRepoManifestRest(orgName, repoName, pathStrings[i], accessToken, tokenBucket)
				.then(content => {
					const name = content?.name || ""
					const version = content?.version || ""
					return { name: name,
						 version: version
						}
				}
			))
		}

		await Promise.allSettled(realDataPromises)
		const realData: { name: string, version:string}[] = []
		for (const d of realDataPromises){
			realData.push(await d.then(
				function name(params:any) {
					return {name: params.name, version: params.version}
				},
				function name(params:any) {
					return {name: "", version: ""}
				}
			))
		}

		let i = 0
		for (const [packageManager, depList] of repo.packageMap) {
			if(packageManager == "RUBYGEMS"){
				for (const subRepo of depList) {
					//TODO: Get name from the X.gemspec file in the same repo, as X is the name we need
				}
			} else {
				for (const subRepo of depList) {
					try{
						subRepo.realName = realData[i].name
						subRepo.version = realData[i].version
					} catch{
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
	function blobPathDeps(subPath: string, subPathName: string, blobPath: string, updatedAt: string, deps: DependencyGraphDependency[] ) {
		return { subPath: subPath, subPathName: subPathName, blobPath: blobPath, version: "", updatedAt: updatedAt, dependencies: deps, realName: ""}
	}

	let repoDepObj: {
		manifest: UpperBranchManifest, packageMap: Map<string, ReturnType<typeof blobPathDeps>[]>
	} = { manifest: repo.repository as UpperBranchManifest, packageMap: new Map() }

	// repoDepObj.packageMap = new Map()

	const depGraphManifests = repo.repository.dependencyGraphManifests
	const files = depGraphManifests.edges
	let index = 0

	const repoUpdateTime = repo.repository.updatedAt

	// iterate through all files in repo to find the ones with package.json
	for (const file of files) {
		const blobPath = file.node.blobPath;
		const subPath = depGraphManifests.nodes[index].filename
		index += 1;
		for (const packageManager of packageManagerFiles) {
			for (const ext of packageManager.extensions) {
				// check path ends with extension
				if (subPath.endsWith(ext)) {
					const subPathName = subPath.replace(ext, "")
					console.log(blobPath + ", " + subPathName + ext)
					const depCount = file.node.dependencies.totalCount

					if (!repoDepObj.packageMap.has(packageManager.name)) {
						repoDepObj.packageMap.set(packageManager.name, [])
					}

					if (depCount > 0) {
						const dependencies = file.node.dependencies.nodes
						const blobPathDep = blobPathDeps(subPath, subPathName, blobPath, repoUpdateTime, dependencies)
						repoDepObj.packageMap.get(packageManager.name)?.push(blobPathDep)
					} else {
						// currently includes package.json files with no dependencies
						const blobPathDep = blobPathDeps(subPath, subPathName, blobPath, repoUpdateTime, [])
						repoDepObj.packageMap.get(packageManager.name)?.push(blobPathDep)
					}
				}
			}
		}
	}
	return repoDepObj
}

// get dependencies of all repos in repoList, repolist: list of repo objects
// repoList generated by getPkgJSONRepos()
function getAllRepoDeps(repoList: BranchManifest[]) {
	let all_dependencies: ReturnType<typeof getRepoDependencies>[] = []
	for (const repo of repoList) {
		const deps = getRepoDependencies(repo)
		if (deps.packageMap.size > 0) {
			all_dependencies.push(deps)
		}
	}
	return all_dependencies
}

function mergeDependenciesLists(managerRepos: Map<string, Repository[]>): Map<string, string[]> {
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
async function getOrgReposCursors(config: { targetOrganisation: string; }, repoCursors:(string | null)[], accessToken: string): Promise<(string | null)[]> {

	const numOfPages = 100
	let hasNextPage = false;
	// let repoCursor = null;

	do {
		let lastCursor: string | null = null
		// the last cursor in a call is always equivalent to endCursor, so we can use it for the next calls
		if (repoCursors.length !== 0) {
			lastCursor = repoCursors[repoCursors.length - 1]
		}


		const response = await queryRepositories(config.targetOrganisation, numOfPages, lastCursor, accessToken) as OrgRepos;

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
 * retry retries an function up to maxAttempts times.
 * If maxAttempts is execed, a list containing all thrown errors will be returned
 */
async function retry<T>(f:()=>Promise<T>, maxAttempts:number):Promise<T>{

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

/**
 * This function fetches repositories and implements the proper error handling and retry logic.
 */
async function fetchingData(config: { targetOrganisation: string; }, accessToken:string ): Promise<{responses: GraphResponse[], failedCursors: (string | null)[]}>  {
	let repoCursors: (string | null)[] = [];
	const promises: Promise<void>[] = [];
	try {

		await retry(() => getOrgReposCursors(config, repoCursors, accessToken), 3);
		repoCursors[0] = null;
		const numOfPages = 1;
		const responses: GraphResponse[] = [];

		const failedCursors: (string | null)[] = [];

		for (let curCursor = 0; curCursor < repoCursors.length; curCursor += numOfPages) {

			promises.push(new Promise(async (resolve, reject) => {
				try {
					// get numOfPages repositories at a time
					const res = await retry(() => queryDependencies(config.targetOrganisation, numOfPages, repoCursors[curCursor], accessToken) as Promise<GraphResponse>, 2);
					responses.push(res);
				} catch (e) {
					const cursors = repoCursors.slice(curCursor, curCursor + numOfPages);
					if (numOfPages === 1){
						failedCursors.push(...cursors);
					}
					else{
						// if there's a failure, get each repository individually
						try {
							const subPromises = cursors.map(c => retry(() => queryDependencies(config.targetOrganisation, 1, c, accessToken) as Promise<GraphResponse>, 3));
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
			console.warn(`Failed to retrieve ${failedCursors.length} cursors out of ${promises.length} cursors.\nfailed cursors : ${failedCursors}`);
		}

		return {responses, failedCursors}


	} catch (e) {
		throw new Error(`Nothing we can do about this :( ${e}`);
	}
}


async function scrapeOrganisation(config: ReturnType<typeof loadConfig>, accessToken: string) {
	let allDeps = new Map<string, Repository[]>()

	const {responses, failedCursors} = await fetchingData(config, accessToken);

	console.log("Fetched all repositories cursors");
	// const responses = await Promise.all(promises);

	const tokenBucket = new TokenBucket(1000, 60.0/60.0, 1)

	for (const response of responses) {

		for (const repo of response?.organization?.repositories?.edges) {
			const ref = repo.node.mainBranch ? repo.node.mainBranch : repo.node.masterBranch;
			if (ref == null) {
				continue
			}

			const depGraphManifests = ref.repository.dependencyGraphManifests;
			const files: any[] = depGraphManifests.edges;

			console.log(ref.repository.name)

			//This requires files to be sorted by depth, shallowest first
			for (const file of files) {
				const blobPath = file.node.blobPath;
				console.log(blobPath)
			}
		}

		const repoList = getRepos(response);

		const allRepoDeps = getAllRepoDeps(repoList);

		await getRealNames(allRepoDeps, config, accessToken, tokenBucket);

		for (const repo of allRepoDeps) {
			const name = repo.manifest.name

			for (const [packageManager, depList] of repo.packageMap) {
				for (const subRepo of depList) {
					let deps: Map<string, string> = new Map();

					for (const dep of subRepo.dependencies) {
						deps.set(dep.packageName, dep.requirements)
					}

					let rep: Repository = {
						name: subRepo.realName,
						oldName: name + (subRepo.subPath == "" ? "" : "(" + subRepo.subPath + ")"),
						version: subRepo.version,
						lastUpdated: subRepo.updatedAt,
						link: repo.manifest.url,
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

	return allDeps
}

export async function getJsonStructure(accessToken: string, config: Configuration, toUse: string[] | null = null){
	console.log("Configuration:")
	console.log(config)
	console.log(config.targetOrganisation)

	let rateLimiter: PackageRateLimiter = {
		npm: { tokenBucket: new TokenBucket(1000, APIParameters.npm.rateLimit, APIParameters.npm.intialTokens) },
		pypi: { tokenBucket: new TokenBucket(1000, APIParameters.pypi.rateLimit, APIParameters.pypi.intialTokens) },
		rubygems: { tokenBucket: new TokenBucket(1000, APIParameters.rubygems.rateLimit, APIParameters.rubygems.intialTokens) },
	};

	if(toUse == null){
		toUse = ["NPM", "PYPI", "RUBYGEMS"]
	}

	const startTime = Date.now();

	// ==== START: Extracting dependencies from Github graphql response === //

	const allDeps = await scrapeOrganisation(config, accessToken)

	// allDeps: list of dependencies to be given to package APIs
	const packageDeps = mergeDependenciesLists(allDeps);

	let depDataMap: Map<string, Map<string, {version: string}>> = new Map()
	if(toUse.includes("NPM") && packageDeps.has("NPM")){ depDataMap.set("NPM", await getDependenciesNpm(packageDeps.get("NPM") as string[], rateLimiter)) }
	if(toUse.includes("PYPI") && packageDeps.has("PYPI")){ depDataMap.set("PYPI", await getDependenciesPyPI(packageDeps.get("PYPI") as string[], rateLimiter)) }
	if(toUse.includes("RUBYGEMS") && packageDeps.has("RUBYGEMS")){ depDataMap.set("RUBYGEMS", await getDependenciesRubyGems(packageDeps.get("RUBYGEMS") as string[], rateLimiter)) }

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
	jsonResult += "\"npm\": ["
	jsonResult += !(toUse.includes("NPM") && allDeps.has("NPM")) ? "" : generateDependencyTree(allDeps.get("NPM") as Repository[], depDataMap.get("NPM") as any)
	jsonResult += "], "
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
	const accessToken = getAccessToken()
	const config = loadConfig()
	writeFile("cachedData.json", await getJsonStructure(accessToken, config));
}

if (require.main === module) {
    console.log("Running standalone");
	main();
} else {
	//Being called as a module
}
