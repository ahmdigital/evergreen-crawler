import { TokenBucket } from "./rate-limiting/token-bucket";
import { getPackageManifest } from "query-registry";
import { Configuration } from "./utils";
// import { hooks } from "libnpmhook";
const hooks = require('libnpmhook')

export const APIParameters = {
	// Github api allows 5000 reqs per hour. 5000/3600 = 1.388 reqs per second.
	npm: {
		// Some sources suggest npm allows up to 5 million requests per month.
		rateLimit: 5000000 / (3600 * 24 * 30),
		intialTokens: 250,
	},
	pypi: {
		// PyPI has no set rate limit, but says to "[t]ry not to make a lot of requests (thousands) in a short amount
		// of time (minutes)", and "it’s preferred to make requests in serial over a longer amount of time if
		// possible", so we'll keep it at 1000 a minute for now.
		rateLimit: 1000 / 60,
		intialTokens: 1
	},
	rubygems: {
		// https://guides.rubygems.org/rubygems-org-rate-limits/
		// 15 per second for the dependency API
		rateLimit: 15,
		intialTokens: 1
	},
}

	//https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/about-the-dependency-graph
export const packageManagerFiles = [
	{ name: "NPM", extensions: ["package.json"] },
	{ name: "PYPI", extensions: ["requirements.txt"] },
	{ name: "RUBYGEMS", extensions: ["Gemfile", ".gemspec"] },
]

//Ratelimiter is a POJO that contains a TokenBuckets and RequestCounters for each API source.
export type PackageRateLimiter = {
	npm: {
		tokenBucket: TokenBucket;
		//reqCounter: RequestCounter;
	},
	pypi: {
		tokenBucket: TokenBucket;
	},
	rubygems: {
		tokenBucket: TokenBucket;
	},
}

export type Repository = {
	name: string,
	oldName: string,
	version: string,
	lastUpdated: string,
	link: string,
	isArchived: boolean,
	dependencies: Map<string, string>
}

//Gets the information for a single npm dependecy from the external service.
export async function queryDependencyNpm(dependency: string, rateLimiter: PackageRateLimiter, baseUrl: string) {
	await rateLimiter.npm.tokenBucket.waitForTokens(1)

	let manifest
	try{
		manifest = await getPackageManifest({ name: dependency, ...(baseUrl == "" ? {}: {registry: baseUrl})})
	}
	catch(e){
		manifest = { version: "1.0.0"}
		console.log(e)
	}
	baseUrl = baseUrl == "" ? "https://www.npmjs.com" : baseUrl
	return { name: dependency, data: { version: manifest.version, link: baseUrl + "/package/" + dependency } }
}

type PythonPackageVersion = {
	epoch: number,
	first: number,
	rest: number[],
	isPrerelease: boolean,
}

export function parsePythonPackageVersion(versionString: string): PythonPackageVersion {
	//https://peps.python.org/pep-0440/
	//[N!]N(.N)*[{a|b|rc}N][.postN][.devN]
	//Not a complete implementation, just enough for us to get the most recent useable version
	//c instead of rc is not accepted

	let version: PythonPackageVersion = { epoch: 0, first: 0, rest: [], isPrerelease: false }

	//Parse the epoch is present
	const epochPart = versionString.split("!", 2)
	if (epochPart.length == 2) {
		version.epoch = parseInt(epochPart[0])
		versionString = versionString[1]
	}

	const parts = versionString.split(".")

	//A major version number is always present
	version.first = parseInt(parts[0])

	//Parse rest version
	for (let part of parts.slice(1)) {
		const alpha = part.split("a", 2)
		const beta = part.split("b", 2)
		const releaseCandidate = part.split("rc", 2)

		//Parse post or dev version if present, then check for alpha/beta/release candidate
		if (part.substring(0, 3) === "dev") {
			part = part.substring(3)
			version.isPrerelease = true
		} else if (part.substring(0, 4) === "post") {
			part = part.substring(4)
		} else if (alpha.length == 2) {
			version.isPrerelease = true
			part = alpha[0]
		} else if (beta.length == 2) {
			version.isPrerelease = true
			part = beta[0]
		} else if (releaseCandidate.length == 2) {
			version.isPrerelease = true
			part = releaseCandidate[0]
		}

		version.rest.push(parseInt(part))
	}

	return version
}

export function greaterThanPythonPackageVersion(a: PythonPackageVersion, b: PythonPackageVersion): boolean {
	if (a.isPrerelease && !b.isPrerelease) { return false; }
	else if (!a.isPrerelease && b.isPrerelease) { return true; }
	else if (a.first > b.first) { return true; }
	else {
		let isEqual: boolean = true;
		for (let i = 0; i < a.rest.length && i < b.rest.length && isEqual; i++) {
			if (a.rest[i] != b.rest[i]) { return a.rest[i] > b.rest[i] }
		}

		return a.rest.length > b.rest.length
	}
}

//Gets the information for a single pip dependecy from an external service, PyPI.
export async function queryDependencyPyPI(dependency: string, rateLimiter: PackageRateLimiter, baseUrl: string) {
	await rateLimiter.pypi.tokenBucket.waitForTokens(1)

	baseUrl = baseUrl == "" ? "https://pypi.org" : baseUrl

	//https://warehouse.pypa.io/api-reference/, they suggest that our user agent should mention who we are
	const response = await (await fetch(baseUrl + "/pypi/" + dependency + "/json")).json()
	const data = response as { info: { version : any}, releases : any }

	let bestVersion: string = "0"
	let bestVersionObject: PythonPackageVersion = {epoch: 0, first: 0, rest: [], isPrerelease: true}

	//We have to look through all releases to find the most recent, non-pre-release version
	for (const release in data.releases) {
		const version = parsePythonPackageVersion(release)

		if(greaterThanPythonPackageVersion(version, bestVersionObject)){
			bestVersionObject = version
			bestVersion = release
		}
	}

	return { name: dependency, data: { version: bestVersion, link: baseUrl + "/project/" + dependency } }
}

//Gets the information for a single Ruby dependecy from an external service, RubyGems.
export async function queryDependencyRubyGems(dependency: string, rateLimiter: PackageRateLimiter, baseUrl: string) {
	await rateLimiter.rubygems.tokenBucket.waitForTokens(1)

	baseUrl = baseUrl == "" ? "https://rubygems.org" : baseUrl

	//https://guides.rubygems.org/rubygems-org-api/
	const response = await (await fetch(baseUrl + "/api/v1/versions/" + dependency + "/latest.json")).json()
	const data = response as { version: string }

	return { name: dependency, data: { version: data.version, link: baseUrl + "/gems/" + dependency } }
}

//Calls the given API for all dependencies in the given list
async function getDependencies(dependencies: string[], rateLimiter: PackageRateLimiter, queryFunc: any, baseUrl: string) {
		let depMap: Map<string, { version: string, link: string }> = new Map()

		const depList = await Promise.all(
			dependencies.map((dependency) => queryFunc(dependency, rateLimiter, baseUrl))
		);

		for (const dependency of depList) {
			depMap.set(dependency.name, dependency.data)
		}

		return depMap
	}

async function getDependenciesNPMSio(dependencies: string[], rateLimiter: PackageRateLimiter, baseUrl: string): Promise<Map<string, { version: string; link: string; }>> {
		let depMap: Map<string, { version: string, link: string }> = new Map()

		await rateLimiter.npm.tokenBucket.waitForTokens(1)
		// TDOD: limit calls to 250 packages
		const requestOptions = {
		method: 'POST',
		headers: {
			"Accept": "application/json",
			"Content-Type": "application/json"
			},
			body: JSON.stringify(dependencies)
		};
		// const depList: {name: string, data: {version: string, link: string}}[] = []

		await fetch("https://api.npms.io/v2/package/mget", requestOptions)
		.then(response => response.json())
		.then(response => {
			const tempList: any  = []
			for (const dependency in response) {
				const temp = { name: dependency, data: { version: response[dependency].collected.metadata.version, link: baseUrl + "/package/" + dependency } }
				depMap.set(temp.name, temp.data)
			}
		})
		.catch(error => console.log('Error fetching dependencies from npms.io:', error));

		return depMap
	}

// there is a limit of 100 hooks
export async function addNPMHook(packageName:string, endpoint: string, token: string): Promise<Boolean> {
	try {
		await hooks.add(packageName, endpoint, 'supersekrit', {
			authToken: token
		  })
		return true
	} catch (error) {
		console.log(error)
		// throw new Error(`Failed to create npm hook for ${package}: ${error}`);
		return false
	}
}

export async function removeNPMHook(id: string, token: string): Promise<Boolean> {
	try {
		await hooks.rm(id, {
			authToken: token
		  })
		return true
	} catch (error) {
		console.log(error)
		return false
	}
}

export async function listNPMHooks(token: string) {
	const response = await hooks.ls({
		authToken: token
		})
	return response
}


//Calls the npm API for all dependencies in the given list
export async function getDependenciesNpm(dependencies: string[], rateLimiter: PackageRateLimiter, config: Configuration) {
	// return getDependencies(dependencies, rateLimiter, queryDependencyNpm, config.npmURL ?? "")
	return getDependenciesNPMSio(dependencies, rateLimiter, config.npmURL ?? "")
}

//Calls the PyPI API for all dependencies in the given list
export async function getDependenciesPyPI(dependencies: string[], rateLimiter: PackageRateLimiter, config: Configuration) {
	return getDependencies(dependencies, rateLimiter, queryDependencyPyPI, config.pipURL ?? "")
}

//Calls the RubyGems API for all dependencies in the given list
export async function getDependenciesRubyGems(dependencies: string[], rateLimiter: PackageRateLimiter, config: Configuration) {
	return getDependencies(dependencies, rateLimiter, queryDependencyRubyGems, config.rubygemsURL ?? "")
}
