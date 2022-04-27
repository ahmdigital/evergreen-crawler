import { Octokit, RestEndpointMethodTypes } from "@octokit/rest";
import { getPackageManifest } from "query-registry";
import { RequestCounter } from "./rate-limiting/request-counter";
import { TokenBucket } from "./rate-limiting/token-bucket";
import { graphql } from "@octokit/graphql";
import type {
	GraphQlQueryResponseData,
	GraphqlResponseError
} from "@octokit/graphql";
import { sleep, getAccessToken } from "./utils";
import { printHashBar, printSpacer } from "./ioFormatting";

var Map = require("es6-map");

//Ratelimiter is a POJO that contains a TokenBuckets and RequestCounters for each API source.
type RateLimiter = {
	// Github: {
	// 	tokenBucket: TokenBucket;
	// 	reqCounter: RequestCounter;
	// };
	npm: {
		tokenBucket: TokenBucket;
		//reqCounter: RequestCounter;
	};
};

//Declaring a type alias for representing a repository in order to avoid this octokit mess
type OctokitRepository =
	RestEndpointMethodTypes["repos"]["listForOrg"]["response"]["data"][0];


type DependencyGraphDependency = {
	packageName: string
	requirements: string
	hasDependencies: string
	packageManager: string
}

type DependencyGraphManifest = {
	node: {
		blobPath: string,
		dependencies: {
			totalCount: number,
			nodes: DependencyGraphDependency[]
		}
	}
}

type DependencyGraphManifests = {
	 totalCount: number
	 nodes: {
		 filename: string
	 }[]
	 edges: DependencyGraphManifest[]
}
// TODO: 
type DependencyGraphManifestConnection = {
}

type UpperBranchManifest = {
	defaultBranchRef: {
		name: string,
	},
	description: string,
	isArchived: boolean,
	isLocked: boolean,
	isPrivate: boolean,
	url: string,
	name: string,
	stargazerCount: number,
	updatedAt: string
}

type BranchManifest = {
	repository: UpperBranchManifest & {dependencyGraphManifests: DependencyGraphManifests}
}

type RepoEdge = {
	node: {
		mainBranch: BranchManifest | null,
		masterBranch: BranchManifest | null
	},
	cursor: string
}

type GraphResponse = {
	rateLimit: {
		cost: number,
		remaining: number,
		resetAt: string
		
	},
	organization: {
		id: string
		repositories: {
			edges: RepoEdge[]
		}
	}
}

// Defining the GitHub API client.
let octokit: Octokit;

/*
Print a nice report for the given repository
*/
async function printDependencies(
	packageJsonContent: any,
	repo: OctokitRepository,
	dependenciesVersions: any,
	dependencies: [string, string][]
) {
	const name = packageJsonContent?.name;
	const version = packageJsonContent?.version;
	const description = packageJsonContent?.description;
	const keywords = packageJsonContent?.keywords;

	printHashBar();

	// Extract and print some information that might be useful for future use.
	console.log("GitHub information:");
	console.log("Name:", repo.name);
	console.log(
		"Description:",
		repo.description ? repo.description : "[Missing]"
	);
	console.log("Language:", repo.language ? repo.language : "[Missing]");
	console.log("Last Updated:", repo.updated_at ? repo.updated_at : "[Missing]");

	console.log();

	// Extract and print some information that might be useful for future use.
	console.log("package.json information:");

	console.log("Name:", name ? name : "[Missing]");
	console.log("Version:", version ? version : "[Missing]");
	console.log("Description:", description ? description : "[Missing]");
	console.log("Keywords:", keywords ? keywords : "");

	console.log();
	console.log();
	console.log("Dependencies:");

	if (dependenciesVersions.length === 0) {
		console.log("\t None found");
	}

	for (const [dependency, version] of dependenciesVersions) {
		console.log(
			"\t",
			dependency,
			" - Used version:",
			dependencies[dependency],
			"| Latest version:",
			version
		);
	}

	printHashBar();
	console.log();
}

function printRateLimitInfo(
	startTime: Date,
	endTime: Date,
	rateLimiter: RateLimiter
) {
	const elapsedInMinutes =
		(endTime.getTime() - startTime.getTime()) / 1000 / 60;

	let printRT = function printRequestTimes(name: string, total: number) {
		console.log(name, " requests:");
		console.log(
			"\t",
			"Total:",
			total,
			"Average:",
			(total / (elapsedInMinutes * 60)).toFixed(2),
			"reqs/s"
		);
	};

	printSpacer();

	console.log("Elapsed time:", elapsedInMinutes.toFixed(2), "minutes");

	//printRT("Github", rateLimiter.Github.reqCounter.getTotalRequests());
	//printRT("npm", rateLimiter.npm.reqCounter.getTotalRequests());
	// printRT(
	// 	"Total",
	// 	rateLimiter.Github.reqCounter.getTotalRequests() +
	// 		rateLimiter.npm.reqCounter.getTotalRequests()
	// );
}


async function getSingleDep(dependency: string, rateLimiter: RateLimiter) {
	await rateLimiter.npm.tokenBucket.waitForTokens(1);
	//rateLimiter.npm.reqCounter.addRequest();
	const manifest = await getPackageManifest({ name: dependency });
	return { name: dependency, data: { version: manifest.version } };
}

async function getNpmDeps(dependencies: string[], rateLimiter: RateLimiter) {
	let depMap: Map<string, { version: string }> = new Map();
	// for (const dependency in dependencies) {
	// 	await rateLimiter.npm.tokenBucket.waitForTokens(1)
	// 	rateLimiter.npm.reqCounter.addRequest()
	// 	const manifest = await getPackageManifest({ name: dependency })
	// 	depMap.set(dependency, manifest)
	// }

	dependencies.map((value) => {});

	const depList = await Promise.all(
		dependencies.map((dependency) => getSingleDep(dependency, rateLimiter))
	);

	for (const dependency of depList) {
		depMap.set(dependency.name, dependency.data);
	}

	return depMap;
}

type Repository = {
	name: string,
	version: string,
	link: string,
	isArchived: boolean,
	dependencies: any
}

function mergeDependenciesLists(repos: Repository[]): string[] {
	let deps = new Set<string>();

	for (const repo of repos) {
		for (const name in repo[4]) {
			deps.add(name);
		}
	}

	return Array.from(deps.values());
}

function depDataToJson(
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

function generateDependencyTree(
	data: Repository[],
	depMap: Awaited<ReturnType<typeof getNpmDeps>>
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

		for (const depName in d.dependencies) {
			const depVersion = d.dependencies[depName];
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

async function queryGraphQL(accessToken: string) : Promise<GraphQlQueryResponseData> {
  
  const graphqlWithAuth = graphql.defaults({
    headers: {
      authorization: `token ${accessToken}`,
      accept: `application/vnd.github.hawkgirl-preview+json`,
    },
  });
  let response: GraphQlQueryResponseData;

  // refer to this on how to query different branches/ref,
  // https://stackoverflow.com/questions/51504760/how-to-get-all-repos-that-contain-a-certain-branch-on-githubs-graphql-api
  // TODO: limit to default branch, current setup no working 
  response = graphqlWithAuth(
    `
	query orgRepos($queryString: String!, $NumOfPages: Int!) {
		rateLimit{
		   cost
		   remaining
		   resetAt
		   }
		 organization(login: $queryString) {
		 id
		 repositories(first: $NumOfPages, orderBy: {field: CREATED_AT, direction: ASC
		   }) {
		   edges {
		   node {
			   mainBranch: ref(qualifiedName: "main"){
						   ...repositoryFields
						   }
			  masterBranch: ref(qualifiedName: "master"){
				  ...repositoryFields
				  }
			  }
		   cursor
			 }
		   }
		 }
	   }
   fragment repositoryFields on Ref {
	   repository{
		  defaultBranchRef {
			  name
			  }
		  description
		  isArchived
		  isLocked
		  isPrivate
		  url
		  name
		  stargazerCount
		  updatedAt
		   dependencyGraphManifests(withDependencies: true) {
			  totalCount
			  nodes {
				  filename
				  }
			  edges {
				  node {
					  blobPath
					  dependencies {
						  totalCount
						  nodes {
						  packageName
						  requirements
						  hasDependencies
						  packageManager
							  }
						  }
					  }
				  cursor
			   }
		   }
	   }
   }
        `,
    {
      queryString: "octokit",
      NumOfPages: 5,
    }
  );

  return response;
}

type Node = {
	packageName: string;
	requirements: string;
	hasDependencies: string;
	packageManager: string;
}

  
// gets repos that have package.json, returns list of repo objects 
function getPkgJSONRepos(response: GraphResponse) {
	const PKG_JSON = "package.json";
	const allRepos: RepoEdge[] = response?.organization?.repositories?.edges;
	let filteredRepos: BranchManifest[] = []
	for(const repo of allRepos) {
		console.log(repo);
		const ref = repo.node.mainBranch ? repo.node.mainBranch : repo.node.masterBranch;
		if(ref == null){
			continue
		}

		const depGraphManifests = ref.repository.dependencyGraphManifests;
		const files: any[] = depGraphManifests.edges;

		//This requires files to be sorted by depth, shallowest first
		for (const file of files) {
			const blobPath = file.node.blobPath;
			if (blobPath.endsWith(PKG_JSON)) {
				filteredRepos.push(ref)
				break
			}

		}
	}
	return filteredRepos
}

// Params: blobPath: name of blobPath string, deps: dependencies list from blobPath. 
// returns object with { blob path: <file name eg. /blah/package.json>,  dependencies: <list of deps from blobpath file> }


// get dependencies of a repo obj, used by function getAllRepoDeps(repoList)
// returns object with repo name and list of blob paths ending with package.json and blob path's dependencies
function getRepoDependencies(repo: BranchManifest) {
	// add more extensions in the future
	const extensions: string[] = ["package.json"];
	
	
	function blobPathDeps(subPath: string, blobPath: string, version: string, deps: DependencyGraphDependency[]) {
		return {
			subPath: subPath,
			blobPath: blobPath,
			version: version,
			dependencies: deps
		}
	}

	let repoDepObj: {
		manifest: UpperBranchManifest,
		blobPathDepsList: ReturnType<typeof blobPathDeps>[]
	} = {
		manifest: repo.repository as UpperBranchManifest, 
		blobPathDepsList: []
	}

	const depGraphManifests = repo.repository.dependencyGraphManifests
	const files = depGraphManifests.edges
	let index = 0
	// iterate through all files in repo to find the ones with package.json
	for (const file of files) {
		const blobPath = file.node.blobPath;
		const subPath = depGraphManifests.nodes[index].filename
		for (const ext of extensions) {
			// check blobpath ends with extension 
			if (blobPath.endsWith(ext)) {
				console.log(blobPath + ", " + subPath)
				const version = ""//file.node.version
				const depCount = file.node.dependencies.totalCount
				if (depCount > 0){
					const dependencies = file.node.dependencies.nodes
					const blobPathDep = blobPathDeps(subPath, blobPath, version, dependencies)
					repoDepObj.blobPathDepsList.push(blobPathDep)
				}
				else{
					// currently includes package.json files with no dependencies
					const blobPathDep = blobPathDeps(subPath, blobPath, version, [])
					repoDepObj.blobPathDepsList.push(blobPathDep)
				}

			}
		}
	}
	return repoDepObj;

};


// get dependencies of all repos in repoList, repolist: list of repo objects
// repoList generated by getPkgJSONRepos()
function getAllRepoDeps(repoList: BranchManifest[]){
	let all_dependencies: ReturnType<typeof getRepoDependencies>[] = []
	for (const repo of repoList){
		const deps = getRepoDependencies(repo)
		all_dependencies.push(deps)
	}
	return all_dependencies
}

// async function requestRepoDependenciesFromNPN(repo: Repository, rateLimiter: RateLimiter) {
//       const dependenciesVersions: [string, string][] = [];
//       console.log(repo)
//       for (const manifest in repo.blobPathDepsList){
//       	for (const dependency in manifest?.dependencies) {
//       		dependenciesVersions.push([dependency.packageName, dependency.requirements]);
  
//       }
//   //   //Use the npm api to get the version of dependencies
//   //   const dependencies = packageJsonContent?.dependencies || {};
//   //   //We'll store them here to print them later
  
//   //   for (const dependency in dependencies) {
//   //     await rateLimiter.npm.tokenBucket.waitForTokens(1);
//   //     rateLimiter.npm.reqCounter.addRequest();
//   //     const manifest = await getPackageManifest({ name: dependency });
  
//   //     dependenciesVersions.push([dependency, manifest.version]);
//   //   }
  
//   }

//Main function
async function main() {
	const accessToken = getAccessToken();

	const rateLimiter: RateLimiter = {
		// Github: {
		// 	// Github api allows 5000 reqs per hour. 5000/3600 = 1.388 reqs per second.
		// 	tokenBucket: new TokenBucket(100, 1.388, 0),
		// 	reqCounter: new RequestCounter(10000, "GitHub"),
		// },
		npm: {
			// Some sources suggest npm allows up to 5 million requests per month.
			// 5000000 / (3600 * 24 *	30) = 1.929 reqs per second
			tokenBucket: new TokenBucket(100, 1.929, 0),
			//reqCounter: new RequestCounter(10000, "npm"),
		},
	};

	const startTime = new Date();

	const response = await queryGraphQL(accessToken);
	console.log(response);
	// throw new Error("hello");

	// ==== START: Extracting dependencies from Github graphql response === //

	//TODO: make sure following loop can run concurrently
	//let allDepPromises: Promise<Repository>[] = [];
	const allDeps: Repository[] = [] //await Promise.all(allDepPromises);

	/*For each page...*/{
		const repoList = getPkgJSONRepos(response as GraphResponse);
		console.log(repoList);
		const allRepoDeps = getAllRepoDeps(repoList);
		console.log(JSON.stringify(allRepoDeps, null, " "));

		for(const repo of allRepoDeps){
			const name = repo.manifest.name
			for(const subRepo of repo.blobPathDepsList){
				let rep: Repository
				rep.name = name + "(" + subRepo.subPath + ")"
				rep.version = subRepo.version
				rep.link = repo.manifest.url
				rep.isArchived = repo.manifest.isArchived

				let deps = [];

				for(const dep of subRepo.dependencies){
						//TODO: work out what type deps should be
				}

				rep.dependencies = deps

				allDeps.push(rep)
			}
		}
	}

	const npmDeps = mergeDependenciesLists(allDeps);

	const depDataMap = await getNpmDeps(npmDeps, rateLimiter);

	//Wait for all requests to finish
	console.log("Waiting for all requests to finish");
	await Promise.all([
		//rateLimiter.Github.tokenBucket.waitForShorterQueue(1000),
		rateLimiter.npm.tokenBucket.waitForShorterQueue(1000),
	]);

	//Cleanup the req counters
	// rateLimiter.Github.reqCounter.pause();
	//rateLimiter.npm.reqCounter.pause();

	//Print req counters report
	const endTime = new Date();

	//At this point the bucket queue will be empty, but there might still be some requests in flight.
	await sleep(3000);

	printRateLimitInfo(startTime, endTime, rateLimiter);

	console.log(JSON.stringify(generateDependencyTree(allDeps, depDataMap)));
}

main();
