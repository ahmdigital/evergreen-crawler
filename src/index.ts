import { Octokit, RestEndpointMethodTypes } from "@octokit/rest";
import { TokenBucket } from "./rate-limiting/token-bucket";
import { getAccessToken, loadConfig, writeFile, Configuration } from "./utils";
import { generateDependencyTree } from "./outputData";
import { getDependenciesNpm, getDependenciesPyPI, Repository, APIParameters, PackageRateLimiter, getDependenciesRubyGems, packageManagerFiles } from "./packageAPI";
import { DependencyGraphDependency, GraphResponse, OrgRepos, RepoEdge, BranchManifest, UpperBranchManifest, queryDependencies, queryRepositories } from "./graphQLAPI"

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

// get dependencies of a repo obj, used by function getAllRepoDeps(repoList)
// returns object with repo name and list of blob paths ending with package.json and blob path's dependencies
function getRepoDependencies(repo: BranchManifest) {

	function blobPathDeps(subPath: string, blobPath: string, version: string, deps: DependencyGraphDependency[]) {
		return { subPath: subPath, blobPath: blobPath, version: version, dependencies: deps }
	}

	let repoDepObj: {
		manifest: UpperBranchManifest, packageMap: Map<string, ReturnType<typeof blobPathDeps>[]>
	} = { manifest: repo.repository as UpperBranchManifest, packageMap: new Map() }

	// repoDepObj.packageMap = new Map()

	const depGraphManifests = repo.repository.dependencyGraphManifests
	const files = depGraphManifests.edges
	let index = 0
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
					const version = ""//file.node.version
					const depCount = file.node.dependencies.totalCount

					if(!repoDepObj.packageMap.has(packageManager.name)){
						repoDepObj.packageMap.set(packageManager.name, [])
					}

					if (depCount > 0) {
						const dependencies = file.node.dependencies.nodes
						const blobPathDep = blobPathDeps(subPathName, blobPath, version, dependencies)
						repoDepObj.packageMap.get(packageManager.name)?.push(blobPathDep)
					} else {
						// currently includes package.json files with no dependencies
						const blobPathDep = blobPathDeps(subPathName, blobPath, version, [])
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
		if(deps.packageMap.size > 0){
			all_dependencies.push(deps)
		}
	}
	return all_dependencies
}

function mergeDependenciesLists(managerRepos: Map<string, Repository[]>): Map<string, string[]> {
	let deps: Map<string, Set<string>> = new Map()

	for (const [packageManager, repos] of managerRepos) {
		//console.log(packageManager)
		for(const repo of repos){
			for (const [name] of repo.dependencies) {
				//console.log("\t" + name)
				if(!deps.has(packageManager)){ deps.set(packageManager, new Set()) }
				deps.get(packageManager)?.add(name);
			}
		}
	}

	let managerDeps: Map<string, string[]> = new Map()

	for(const [key, value] of deps){
		managerDeps.set(key, Array.from(value.values()))
	}

	return managerDeps
}

async function scrapeOrganisation(config: ReturnType<typeof loadConfig>, accessToken: string){
	let allDeps: Map<string, Repository[]> = new Map()

	let repoCursors: (string | null)[] = []

	let hasNextPage = false;
	let repoCursor = null;
	do{
		const response = await queryRepositories(config.targetOrganisation, null) as OrgRepos

		for (const repo of response.organization.repositories.edges) {
			repoCursors.push(repo.cursor)
		}

		hasNextPage = response?.organization?.repositories?.pageInfo?.hasNextPage
		if (hasNextPage) {
			repoCursor = response?.organization?.repositories?.pageInfo?.endCursor
		}

	} while(hasNextPage)
	// overwrite the first value to null
	repoCursors[0] = null
	repoCursor = null;
	hasNextPage = false;

	let responses: Promise<GraphResponse>[] = []
	const numOfPages = 1
	for (let curCursor = 0; curCursor < repoCursors.length; curCursor+=numOfPages){
		responses.push(await queryDependencies(config.targetOrganisation, numOfPages, repoCursors[curCursor]) as Promise<GraphResponse>)
	}
	console.log("Fetched all cursors for the organisation")
	await Promise.all(responses).catch(function(err) {
		console.log("Failed to get information for a repository!")
		console.log(err.message)
		process.exit(1)
	})
	console.log("Received all repository information")

	for(const responsePromise of responses){
		const response = await responsePromise
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

		for (const repo of allRepoDeps) {
			const name = repo.manifest.name

			for(const [packageManager, depList] of repo.packageMap){
				for (const subRepo of depList) {
					let deps: Map<string, string> = new Map();

					for (const dep of subRepo.dependencies) {
						deps.set(dep.packageName, dep.requirements)
					}

					let rep: Repository = {
						name: name + (subRepo.subPath == "" ? "" : "(" + subRepo.subPath + ")"),
						version: subRepo.version,
						link: repo.manifest.url,
						isArchived: repo.manifest.isArchived,
						dependencies: deps
					}

					if(!allDeps.has(packageManager)){
						allDeps.set(packageManager, [])
					}
					allDeps.get(packageManager)?.push(rep)
				}
			}
		}

		// hasNextPage = response?.organization?.repositories?.pageInfo?.hasNextPage
		// if (hasNextPage) {
		// 	repoCursor = response?.organization?.repositories?.pageInfo?.endCursor
		// }
	}

	return allDeps
}

export async function getJsonStructure(accessToken: string, config: Configuration, toUse: string[] | null = null){
	console.log("Configuration:")
	console.log(config)
	console.log(config.targetOrganisation)

	const rateLimiter: PackageRateLimiter = {
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

// main();
