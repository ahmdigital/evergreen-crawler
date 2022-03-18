
import { Octokit } from "@octokit/rest";
import * as fs from "fs";

async function sleep(millis:number){
	return new Promise(resolve => setTimeout(resolve, millis));
}

/**
 * The following is a spike on how to use the GitHub API to
 * - List repositories under an organization
 * - Locating the package.json file for a repository
 * - Downloading and Parsing the contents of the package.json file
 * 
 * Next steps are to:
 * - Find the repositories of the dependencies of the repositories
 * - Repeating the process to create a dependency graph
 */
async function main() {

	//read file access_token.txt 
	let access_token: string
	try {
		access_token = fs.readFileSync("access_token.txt").toString();
	} catch (e) {
		console.log("access_token.txt file not found. I'll continue without one in...");
		console.log("5")
		await sleep(1000);
		console.log("4")
		await sleep(1000);
		console.log("3")
		await sleep(1000);
		console.log("2")
		await sleep(1000);
		console.log("1")
		await sleep(1000);
		console.log("You wanted this...")
		access_token = ""
	}

	// Instantiating the GitHub API client.
	const octokit = new Octokit({
		auth: access_token,
		log: {
			debug: () => { },
			info: () => { },
			warn: console.warn,
			error: console.error,
		},
		request: {
			agent: undefined,
			fetch: undefined,
			timeout: 0,
		}
	})

	// List the public repositories owned by the octokit organization:
	const repos = await octokit.repos.listForOrg({
		org: "octokit",
		type: "public",
		per_page: 100,  //TODO: implement pagination
	});

	// Filter for repositories written in javascript or typescript.
	//!	Note, some repositories might not have a .language property set. 
	const jsOrTsRepos = repos.data
		.filter(repo => repo.language === "TypeScript" || repo.language === "JavaScript")

	// For each repository, find the package.json file.
	// This requires multiple steps.
	for (const repo of jsOrTsRepos) {

		// Extract and print some information that might be useful for future use.
		console.log("GitHub information:")
		console.log("Name:", repo.name);
		repo.description && console.log("Description:", repo.description);
		repo.language && console.log("Language:", repo.language);
		repo.updated_at && console.log("Last Updated:", repo.updated_at);

		console.log()

		// Get main_branch name from repo
		const r = await octokit.repos.get({
			owner: "octokit",
			repo: repo.name,
		});

		const main_branch = r.data.master_branch || "master";

		// Get branch sha from branch
		const branch = await octokit.repos.getBranch({
			owner: "octokit",
			repo: repo.name,
			branch: main_branch,
		});

		const sha = branch.data.commit.sha;

		// Get the repo tree, i.e. the list of all file and folder names in the repo.
		// This is a recursive call, meaning even files inside folders will be returned.
		// TODO: handle the case where the repo has a tree too big to be returned in one recursive call and must be paginated
		const tree = await octokit.git.getTree({
			owner: "octokit",
			repo: repo.name,
			tree_sha: sha,
			recursive: "yes",
		})

		if (tree.data.truncated) {
			console.log("Tree is truncated, we are missing some data :(");
		}

		//filter for package.json files
		const packageJsons = tree.data.tree
			.filter(item => item.path === "package.json")

		if (packageJsons.length === 0) {
			console.log("No package.json found");
			continue
		}
		if (packageJsons.length > 1) {
			console.log("More than one package.json found");
			//TODO: handle the case in which multiple package.json files are found
		}

		const packageJson = packageJsons[0];

		// Download and parse the content of the package.json
		const packageJsonContent = await octokit.repos.getContent({
			owner: "octokit",
			repo: repo.name,
			path: packageJson.path,
		})
			.then(res => (res.data as any)?.content)                     //the content keyword is not guaranteed to be present in the response
			.then(content => {
				if (content === null) {
					throw new Error("package.json is empty");
				}
				return content as string;
			})
			.then(content => Buffer.from(content, 'base64').toString())  // the content is served as base64, so we need to decode it into a string
			.then(content => JSON.parse(content));						 // parse the JSON in the package.json

		// Extract and print some information that might be useful for future use.
		console.log("package.json information:")
		const name = packageJsonContent?.name;
		const version = packageJsonContent?.version;
		const description = packageJsonContent?.description;
		const keywords = packageJsonContent?.keywords;

		name && console.log("Name:", name);
		version && console.log("Version:", version);
		description && console.log("Description:", description);
		keywords && console.log("Keywords:", keywords);
		console.log("dependencies:", packageJsonContent?.dependencies);
		console.log("devDependencies:", packageJsonContent?.devDependencies);


		console.log()
		console.log("#############################################################################################")
		console.log()

		//! You might want to unccomment this while playing around
		//return
	}
}
main()



