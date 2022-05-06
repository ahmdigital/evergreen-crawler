export function printSpacer(){
	console.log()
	console.log("==============================================================")
	console.log()
}

export function printHashBar(){
	console.log("#############################################################################################")
}


/*
Print a nice report for the given repository
*/
/*
export async function printDependencies(
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
*/

/*
export function printRateLimitInfo(
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
*/
