import { TokenBucket } from "./rate-limiting/token-bucket";
import { getPackageManifest } from "query-registry";

export const RequestRate = {
	// Some sources suggest npm allows up to 5 million requests per month.
	npm: 5000000 / (3600 * 24 *	30)
}

//Ratelimiter is a POJO that contains a TokenBuckets and RequestCounters for each API source.
export type PackageRateLimiter = {
	npm: {
		tokenBucket: TokenBucket;
		//reqCounter: RequestCounter;
	}
}

export type Repository = {
	name: string,
	version: string,
	link: string,
	isArchived: boolean,
	dependencies: Map<string, string>
}

//Gets the information for a single dependecy from an external service.
//TODO: This is currently hardcoded to be npm, but this should suppoPackageRateLimiter sources
export async function getSingleDep(dependency: string, rateLimiter: PackageRateLimiter) {
	await rateLimiter.npm.tokenBucket.waitForTokens(1);
	const manifest = await getPackageManifest({ name: dependency });
	return { name: dependency, data: { version: manifest.version } };
}

//Calls the npm API for all dependencies in the given listPackageRateLPackageRateLimiter) {
export async function getNpmDeps(dependencies: string[], rateLimiter: PackageRateLimiter) {
	let depMap: Map<string, { version: string }> = new Map();
	//dependencies.map((value) => {});

	const depList = await Promise.all(
		dependencies.map((dependency) => getSingleDep(dependency, rateLimiter))
	);

	for (const dependency of depList) {
		depMap.set(dependency.name, dependency.data);
	}

	return depMap;
}