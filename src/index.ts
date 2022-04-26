import { Octokit, RestEndpointMethodTypes } from "@octokit/rest";
import * as fs from "fs";
import { getPackageManifest } from "query-registry";
import { RequestCounter } from "./rate-limiting/request-counter";
import { TokenBucket } from "./rate-limiting/token-bucket";
import * as inquier from "inquirer";
import { sleep } from "./utilts";
import { graphql } from "@octokit/graphql";
import type { GraphQlQueryResponseData, GraphqlResponseError } from "@octokit/graphql";

//Ratelimiter is a POJO that contains a TokenBuckets and RequestCounters for each API source.
type RateLimiter = {
	Github: {
		tokenBucket: TokenBucket;
		reqCounter: RequestCounter;
	};
	npm: {
		tokenBucket: TokenBucket;
		reqCounter: RequestCounter;
	};
};

//Declaring a type alias for representing a repository in order to avoid this octokit mess
type Repository =
	RestEndpointMethodTypes["repos"]["listForOrg"]["response"]["data"][0];

//TODO: see if @octokit/graphql provides types
// type DependencyGraphManifestEdges = {

// }

// type DependencyGraphManifest = {
//   totalCount: number
//   nodes: {
//     filename: string
//   }[]
//   edges:  
// }

// type RepoEdge = {
//   node: {
//     name: string
//     description: string
//     dependencyGraphManifests: 
//   }
//   cursor: string
// }

// type GraphResponse = {
//   data: {
//     organization: {
//       id: string
//       repositories: {
//         edges: RepoEdge[]
//       }
//     }
//   }
// }




// Defining the GitHub API client.
let octokit: Octokit;

//Read the "access_token.txt" file to grab the accesstoken.
async function getAccessToken(): Promise<string> {
	let access_token: string;
	try {
		access_token = fs.readFileSync("access_token.txt").toString();
		return access_token;
	} catch (e) {
		let isInputValid = false;
		let processedAns: string;
		while (!isInputValid) {
			const ans = await inquier.prompt([
				"access_token.txt file not found. Do you want to continue without one? (Yes)/No:",
			]);
			processedAns = (ans as string).toLowerCase().trim();

			isInputValid =
				processedAns === "yes" ||
				processedAns === "no" ||
				processedAns === "y" ||
				processedAns === "n" ||
				processedAns === "";
		}

		if (processedAns === "no" || processedAns === "n")
			throw new Error("access_token.txt file not found");

		return "";
	}
}

//Find dependencies of a repository
async function findDependencies(repo: Repository, rateLimiter: RateLimiter) {
	// Get main_branch name from repo
	await rateLimiter.Github.tokenBucket.waitForTokens(1);
	rateLimiter.Github.reqCounter.addRequest();
	const r = await octokit.repos.get({
		owner: "octokit",
		repo: repo.name,
	});

	const main_branch = r.data.master_branch || "master";

	// Get branch sha from branch
	await rateLimiter.Github.tokenBucket.waitForTokens(1);
	rateLimiter.Github.reqCounter.addRequest();
	const branch = await octokit.repos.getBranch({
		owner: "octokit",
		repo: repo.name,
		branch: main_branch,
	});

	const sha = branch.data.commit.sha;

	// Get the repo tree, i.e. the list of all file and folder names in the repo.
	// This is a recursive call, meaning even files inside folders will be returned.
	// TODO: handle the case where the repo has a tree too big to be returned in one recursive call and must be paginated
	await rateLimiter.Github.tokenBucket.waitForTokens(1);
	rateLimiter.Github.reqCounter.addRequest();
	const tree = await octokit.git.getTree({
		owner: "octokit",
		repo: repo.name,
		tree_sha: sha,
		recursive: "yes",
	});

	if (tree.data.truncated) {
		console.log("Tree is truncated, we are missing some data :(");
	}

	//filter for package.json files
	const packageJsons = tree.data.tree.filter((item) =>
		item.path.endsWith("package.json")
	);

	if (packageJsons.length === 0) {
		console.log("No package.json found");
		return;
	}
	if (packageJsons.length > 1) {
		//console.log("More than one package.json found");
		//TODO: handle the case in which multiple package.json files are found
	}

	const packageJson = packageJsons[0];

	// Download and parse the content of the package.json
	await rateLimiter.Github.tokenBucket.waitForTokens(1);
	rateLimiter.Github.reqCounter.addRequest();
	const packageJsonContent = await octokit.repos
		.getContent({
			owner: "octokit",
			repo: repo.name,
			path: packageJson.path,
		})
		.then((res) => (res.data as any)?.content) //the content keyword is not guaranteed to be present in the response
		.then((content) => {
			if (content === null) {
				throw new Error("package.json is empty");
			}
			return content as string;
		})
		.then((content) => Buffer.from(content, "base64").toString()) // the content is served as base64, so we need to decode it into a string
		.then((content) => JSON.parse(content)); // parse the JSON in the package.json

	//Use the npm api to get the version of dependencies
	const dependencies = packageJsonContent?.dependencies || {};
	//We'll store them here to print them later
	const dependenciesVersions: [string, string][] = [];

	for (const dependency in dependencies) {
		await rateLimiter.npm.tokenBucket.waitForTokens(1);
		rateLimiter.npm.reqCounter.addRequest();
		const manifest = await getPackageManifest({ name: dependency });

		dependenciesVersions.push([dependency, manifest.version]);
	}

	//Print a nice report for this repository

	console.log(
		"#############################################################################################"
	);
	const name = packageJsonContent?.name;
	const version = packageJsonContent?.version;
	const description = packageJsonContent?.description;
	const keywords = packageJsonContent?.keywords;

	// Extract and print some information that might be useful for future use.
	console.log("GitHub information:");
	console.log("Name:", repo.name);
	repo.description && console.log("Description:", repo.description);
	repo.language && console.log("Language:", repo.language);
	repo.updated_at && console.log("Last Updated:", repo.updated_at);

	console.log();

	// Extract and print some information that might be useful for future use.
	console.log("package.json information:");

	name && console.log("Name:", name);
	version && console.log("Version:", version);
	description && console.log("Description:", description);
	keywords && console.log("Keywords:", keywords);

	console.log();
	console.log();
	console.log("Dependencies:");

	if (dependenciesVersions.length === 0) {
		console.log("\t None found");
	}

	dependenciesVersions.forEach(([dependency, version]) => {
		console.log(
			"\t",
			dependency,
			" - Used version:",
			dependencies[dependency],
			"| Latest version:",
			version
		);
	});
	console.log(
		"#############################################################################################"
	);
	console.log();
}

//Main function
async function main() {
	const accessToken = await getAccessToken();

	const graphqlWithAuth = graphql.defaults({
		headers: {
			authorization: `token ${accessToken}`,
			accept: `application/vnd.github.hawkgirl-preview+json`,
		},
	});
	let response: GraphQlQueryResponseData;

	response = await graphqlWithAuth(
		`
		query orgRepos($queryString: String!) {
			organization(login: $queryString) {
			  id
			  repositories(first: 5, orderBy: {field: CREATED_AT, direction: ASC}) {
				edges {
				  node {
					name
				  primaryLanguage {
				  name
				  }
					description
					dependencyGraphManifests {
					  totalCount
					  nodes {
						filename
					  }
					  edges {
						node {
						  blobPath
						  dependencies(first : 2) {
							totalCount
							nodes {
							  packageName
							  requirements
							  hasDependencies
							  packageManager
							}
						  }
						}
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
		}
	);

	console.log(response);

	// Filter for repositories written in javascript or typescript.
	//!	Note, some repositories might not have a .language property set.
	const jsOrTsRepos = response?.organization?.repositories?.edges?.filter(
		(repo) =>
			repo.node.primaryLanguage.name === "TypeScript" ||
			repo.node.primaryLanguage.name === "JavaScript"
	);
	// jsOrTsRepos.forEach(console.log);
	

	// ==== START: Extracting dependencies from Github graphql response === //

	// gets repos that have package.json, returns list of repo objects 
	function getPkgJSONRepos() {
		const PKG_JSON = "package.json";
		const allRepos: any[] = response?.organization?.repositories?.edges;
		let filteredRepos: any[] = []
		for (const repo of allRepos) {
			const depGraphManifests = repo.node.dependencyGraphManifests;
			const files: any[] = depGraphManifests.edges;
			for (const file of files) {
				const blobPath = file.node.blobPath;
				if (blobPath.endsWith(PKG_JSON)) {
					filteredRepos.push(repo)
					break
				}

			}
		}
		return filteredRepos
	}

	// get dependencies of all repos in repoList, repolist: list of repo objects
	// repoList generated by getPkgJSONRepos()
	function getAllRepoDeps(repoList){
		let all_dependencies = []
		for (const repo of repoList){
			const deps = getRepoDependencies(repo)
			all_dependencies.push(deps)
		}
		return all_dependencies
	}

	// Params: blobPath: name of blobPath string, deps: dependencies list from blobPath. 
	// returns object with { blob path: <file name eg. /blah/package.json>,  dependencies: <list of deps from blobpath file> }
	function blobPathDeps(blobPath: string, deps: any) {
		const obj = {
			blobPath: blobPath,
			dependencies: deps
		}
		return obj
	}

	// get dependencies of a repo obj, used by function getAllRepoDeps(repoList)
	// returns object with repo name and list of blob paths ending with package.json and blob path's dependencies
	function getRepoDependencies(repo) {
		// add more extensions in the future
		const extensions: string[] = ["package.json"];
		let repoDepObj = {
			repoName: null,
			blobPathDepsList: []
		};

		repoDepObj.repoName = repo.node.name;
		const depGraphManifests = repo.node.dependencyGraphManifests
		const files = depGraphManifests.edges
		// iterate through all files in repo to find the ones with package.json
		for (const file of files) {
			const blobPath = file.node.blobPath;
			for (const ext of extensions) {
				// check blobpath ends with extension 
				if (blobPath.endsWith(ext)) {
					console.log(blobPath)
					const depCount = file.node.dependencies.totalCount;
					if (depCount > 0){
						const dependencies = file.node.dependencies.nodes;
						const blobPathDep = blobPathDeps(blobPath, dependencies)
						repoDepObj.blobPathDepsList.push(blobPathDep)
					}
					else{
						// currently includes package.json files with no dependencies
						const blobPathDep = blobPathDeps(blobPath, [])
						repoDepObj.blobPathDepsList.push(blobPathDep)
					}

				}
			}
		}
		return repoDepObj;

	};

	// testing output of retrieving repo dependencies
	const repoList = getPkgJSONRepos();
	console.log(repoList);
	const a = getAllRepoDeps(repoList);
	console.log(JSON.stringify(a, null, " "));

	// ==== END: Extracting dependencies from Github graphql response ==== //
	
	throw new Error(":)") // stops code below from running

	const rateLimiter: RateLimiter = {
		Github: {
			// Github api allows 5000 reqs per hour. 5000/3600 = 1.388 reqs per second.
			tokenBucket: new TokenBucket(100, 1.388, 0),
			reqCounter: new RequestCounter(10000, "GitHub"),
		},
		npm: {
			// Some sources suggest npm allows up to 5 million requests per month.
			// 5000000 / (3600 * 24 *  30) = 1.929 reqs per second
			tokenBucket: new TokenBucket(100, 1.929, 0),
			reqCounter: new RequestCounter(10000, "npm"),
		},
	};

	const startTime = new Date();

	// For each repository, find its dependencies
	for (const repo of jsOrTsRepos) {
		findDependencies(repo, rateLimiter);

		//! This doesn't have much sense here, but I decided to leave it here to avoid forgetting about it.
		//Avoid building of backpressure if the queues are too long
		// if (rateLimiter.Github.tokenBucket.getQueueLength() + rateLimiter.npm.tokenBucket.getQueueLength() > 1000) {
		// 	//wait for the queue length to reach length 0 by probing queue length every second
		// 	console.log("Waiting for queues to drain")
		// 	await Promise.all([
		// 		rateLimiter.Github.tokenBucket.waitForShorterQueue(1000),
		// 		rateLimiter.Github.tokenBucket.waitForShorterQueue(1000),
		// 	])
		// }
	}

	//Wait for all requests to finish
	console.log("Waiting for all requests to finish");
	await Promise.all([
		rateLimiter.Github.tokenBucket.waitForShorterQueue(1000),
		rateLimiter.Github.tokenBucket.waitForShorterQueue(1000),
	]);

	//Cleanup the req counters
	rateLimiter.Github.reqCounter.pause();
	rateLimiter.npm.reqCounter.pause();

	//Print req counters report
	const endTime = new Date();
	const elapsedInMinutes =
		(endTime.getTime() - startTime.getTime()) / 1000 / 60;

	//At this point the bucket queue will be empty, but there might still be some requests in flight.
	await sleep(3000);

	console.log();
	console.log("==============================================================");
	console.log();

	console.log("Elapsed time:", elapsedInMinutes.toFixed(2), "minutes");

	console.log("Github requests:");
	console.log(
		"\t",
		"Total:",
		rateLimiter.Github.reqCounter.getTotalRequests(),
		"Average:",
		(
			rateLimiter.Github.reqCounter.getTotalRequests() /
			(elapsedInMinutes * 60)
		).toFixed(2),
		"reqs/s"
	);

	console.log("npm requests:");
	console.log(
		"\t",
		"Total:",
		rateLimiter.npm.reqCounter.getTotalRequests(),
		"Average:",
		(
			rateLimiter.npm.reqCounter.getTotalRequests() /
			(elapsedInMinutes * 60)
		).toFixed(2),
		"reqs/s"
	);

	console.log("Total requests:");
	console.log(
		"\t",
		"Total:",
		rateLimiter.Github.reqCounter.getTotalRequests() +
		rateLimiter.npm.reqCounter.getTotalRequests(),
		"Average:",
		(
			(rateLimiter.Github.reqCounter.getTotalRequests() +
				rateLimiter.npm.reqCounter.getTotalRequests()) /
			(elapsedInMinutes * 60)
		).toFixed(2),
		"reqs/s"
	);
}

main();
