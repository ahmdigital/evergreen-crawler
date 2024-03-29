import {
	GraphQlQueryResponseData,
	GraphqlResponseError,
    graphql,
} from "@octokit/graphql";

import { Octokit } from "@octokit/rest";
import { TokenBucket } from "./rate-limiting/token-bucket";

export type DependencyGraphDependency = {
	packageName: string
	requirements: string
	hasDependencies: string
	packageManager: string
}

export type DependencyGraphManifest = {
	node: {
		filename: string,
		dependenciesCount: string,
		exceedsMaxSize: string,
		parseable: string,
		defaultBranchRef: {
			name: string
		},
		blobPath: string,
		dependencies: {
			totalCount: number,
			nodes: DependencyGraphDependency[]
		}
	},
	cursor: string
}

export type DependencyGraphManifests = {
	 totalCount: number
	 edges: DependencyGraphManifest[],
	 pageInfo: {
		endCursor: string,
		hasNextPage: boolean
	}
}

// TODO: DependencyGraphManifestConnection
export type DependencyGraphManifestConnection = {
}

export type UpperBranchManifest = {
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
	pushedAt: string
}

export type BranchManifest = UpperBranchManifest & {dependencyGraphManifests: DependencyGraphManifests}

export type RepoEdge = {
	node: BranchManifest | null,
	cursor: string
}

export type RateLimit = {
	cost: number,
	remaining: number,
	resetAt: string

}

export type ErrorMessage = {
	message: string
}

export type GraphResponse = {
    errors?: ErrorMessage[]
	rateLimit: RateLimit,
	organization: {
		id: string
		repositories: {
			edges: RepoEdge[],
			pageInfo: {
				endCursor: string,
				hasNextPage: boolean
			}
		}
	}
}

export type OrgRepos = {
    errors?: ErrorMessage[]
	rateLimit: RateLimit,
	organization: {
		id: string
		repositories: {
			edges: {
				node :{
					pushedAt: string,
					url: string,
					updatedAt: string,
					name: string
				}
				cursor: string
			}[]
			pageInfo: {
				endCursor: string,
				hasNextPage: boolean
			}
		}
	}
}

// "errors": [
// 	{
// 		"path": [
// 			"organization",
// 			"repositories",
// 			"edges",
// 			1,
// 			"node",
// 			"dependencyGraphManifests"
// 		],
// 		"locations": [
// 			{
// 				"line": 24,
// 				"column": 11
// 			}
// 		],
// 		"message": "timedout"
// 	}
// ]

export type Manifest = {
	text: string | null
}

export type RepoManifest = {
    errors?: ErrorMessage[]
	rateLimit: RateLimit,
	repository: {
		manifest1: Manifest,
		manifest2?: Manifest,
		manifest3?: Manifest,
		manifest4?: Manifest,
		manifest5?: Manifest,
		manifest6?: Manifest,
		manifest7?: Manifest,
		manifest8?: Manifest,
		manifest9?: Manifest,
		manifest10?: Manifest
	}
}

export async function queryGraphQL(query: string, param: any, token: string) : Promise<GraphQlQueryResponseData> {
	const graphqlWithAuth = graphql.defaults({
	  headers: {
		authorization: `token ${token}`,
		accept: `application/vnd.github.hawkgirl-preview+json`,
	  },
	});
	let response: GraphQlQueryResponseData = graphqlWithAuth(query, param)
	return response
}


export async function queryRepositories(organisation: string, numOfPages: number, repoCursor: string | null, token: string) : Promise<GraphQlQueryResponseData> {
	let query: string =
		`
		query orgRepos($organisation: String!, $numOfPages: Int!, $repoCursor: String) {
		rateLimit {
			  cost
			  remaining
			  resetAt
			}
			organization(login: $organisation) {
			  id
			  repositories(first: $numOfPages, after: $repoCursor, orderBy: {field: PUSHED_AT, direction: DESC}) {
				totalCount
				edges {
				  node {
					pushedAt
					url
					updatedAt
					name
				  }
				  cursor
				}
				pageInfo {
				  endCursor
				  hasNextPage
				}
			  }
			}
		  }
		`
		let param = {
			organisation: organisation,
			numOfPages: numOfPages,
			repoCursor: repoCursor,
		}
	let something = await queryGraphQL(query, param, token)

	return something

}
export async function queryDependencies(organisation: string, numOfPages: number, repoCursor: string | null, token: string) : Promise<GraphQlQueryResponseData> {

  // refer to this on how to query different branches/ref,
  // https://stackoverflow.com/questions/51504760/how-to-get-all-repos-that-contain-a-certain-branch-on-githubs-graphql-api
	let query: string =
		`
		query orgRepos($organisation: String!, $numOfPages: Int!, $repoCursor: String, $dependencyLimit: Int!) {
			rateLimit{
			  cost
			  remaining
			  resetAt
			}
			organization(login: $organisation) {
			  id
			  repositories(first: $numOfPages, after: $repoCursor, orderBy: {field: PUSHED_AT, direction: DESC}
			  ) {
				edges {
				  node {
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
					pushedAt
					updatedAt
					dependencyGraphManifests(withDependencies: true, first: $dependencyLimit) {
					  totalCount
					  edges {
						node {
						  filename
						  dependenciesCount
						  exceedsMaxSize
						  parseable
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
					  pageInfo {
						endCursor
						hasNextPage
					  }
					}
				  }
				  cursor
				}
				pageInfo {
				  endCursor
				  hasNextPage
				}
			  }
			}
		  }
		`

	let param = {
	  organisation: organisation,
      numOfPages: numOfPages,
      repoCursor: repoCursor,
	//   TODO: paging dependencies
	  dependencyLimit: 20
    }
	let something = await queryGraphQL(query, param, token)
  return something
}

/**
 *
 * @param organisation organisation name
 * @param repoName repository name
 * @param defaultBranch default branch name
 * @param manifestPaths manifest paths, must be relative to the repository root, must have a length of less than 10
 * @returns return at most 10 manifests objects
 */
export async function queryRepoManifest(organisation: string, repoName: string, defaultBranch:string, manifestPaths: string[], token: string) : Promise<string[]> {

	// https://graphql.org/learn/queries/#inline-fragments
	// rev-parse compatible path
	// valid manifest file name: package.json, yarn.lock, requirements.txt and others

	// Changing query inside the query is not safe, due to graphql injections, but since we are not doing any mutations, this should be fine

	if (manifestPaths.length > 10) {
		manifestPaths = manifestPaths.slice(0, 10)
		console.warn("Slicing only the first 10 manifests")
	}

	let query: string =
	  	`
		query repoManifest($organisation: String!, $repoName: String!) {
			rateLimit {
			  cost
			  remaining
			  resetAt
			}
			repository(owner: $organisation, name: $repoName) {
			${ manifestPaths.map((manifestPath, id) => `manifest${id+1}: object(expression: "${defaultBranch}:${manifestPath}") {
				... manifestFields
				}`
			).join('\n')}
		}
	}

		fragment manifestFields on Blob {
			text
		}
		`
	  let param = {
		organisation: organisation,
		repoName: repoName,
		defaultBranch: defaultBranch,
	  }
	  const res: GraphQlQueryResponseData = await queryGraphQL(query, param, token);
	  return new Promise((resolve, reject) => {
		const files: string[] = [];
		for (const manifest in res.repository) {
		  files.push(res.repository[manifest]?.text);
		}
		resolve(files);
	  });
  }

  export async function queryRepoManifestRest(organisation: string, repoName: string, path: string, token: string, TokenBucket: TokenBucket): Promise<any> {
	TokenBucket.waitForTokens(1)
	const octokit = new Octokit({
		auth: token,
		log: {
			debug: () => { },
			info: () => { },
			warn: console.warn,
			error: console.error,
		},
		request: {
			agent: undefined,
			fetch: undefined,
			timeout: 30000,
		}
	})

	const packageJsonContent = await octokit.repos.getContent({
		owner: organisation,
		repo: repoName,
		path: path,
	})
		.then(res => (res.data as any)?.content) //the content keyword is not guaranteed to be present in the response
		.then(content => {
			if (content === null) {
				throw new Error("manifest file is empty");
			}
			return content as string;
		})
		.then(content => Buffer.from(content, 'base64').toString()) // the content is served as base64, so we need to decode it into a string
		.then(content => JSON.parse(content)); // parse the JSON in the package.json
	// console.log(packageJsonContent)
	//Use the npm api to get the version of dependencies

	return packageJsonContent
}
