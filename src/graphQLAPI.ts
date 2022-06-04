import { getAccessToken } from "./utils";
import {
	GraphQlQueryResponseData,
	GraphqlResponseError,
    graphql,
} from "@octokit/graphql";

export type DependencyGraphDependency = {
	packageName: string
	requirements: string
	hasDependencies: string
	packageManager: string
}

export type DependencyGraphManifest = {
	node: {
		blobPath: string,
		dependencies: {
			totalCount: number,
			nodes: DependencyGraphDependency[]
		}
	}
}

export type DependencyGraphManifests = {
	 totalCount: number
	 nodes: {
		 filename: string
	 }[]
	 edges: DependencyGraphManifest[]
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
}

export type BranchManifest = {
	repository: UpperBranchManifest & {dependencyGraphManifests: DependencyGraphManifests}
}

export type RepoEdge = {
	node: {
		mainBranch: BranchManifest | null,
		masterBranch: BranchManifest | null
	},
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

export async function queryGraphQL(query: string, param: any) : Promise<GraphQlQueryResponseData> {
	const graphqlWithAuth = graphql.defaults({
	  headers: {
		authorization: `token ${getAccessToken()}`,
		accept: `application/vnd.github.hawkgirl-preview+json`,
	  },
	});
	let response: GraphQlQueryResponseData = graphqlWithAuth(query, param)
	return response
}


export async function queryRepositories(organisation: string, repoCursor: string | null) : Promise<GraphQlQueryResponseData> {
	let query: string =
		`
		query OrgRepos($organisation: String!) {
			rateLimit {
			  cost
			  remaining
			  resetAt
			}
			organization(login: $organisation) {
			  id
			  repositories(first: 100, orderBy: {field: PUSHED_AT, direction: DESC}) {
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
			numOfPages: 100,
			repoCursor: repoCursor,
		}
	return queryGraphQL(query, param)

}
export async function queryDependencies(organisation: string, numOfPages, repoCursor: string | null) : Promise<GraphQlQueryResponseData> {

  // refer to this on how to query different branches/ref,
  // https://stackoverflow.com/questions/51504760/how-to-get-all-repos-that-contain-a-certain-branch-on-githubs-graphql-api
  // TODO: limit to default branch, current setup no working
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
		 repositories(first: $numOfPages, after: $repoCursor , orderBy: {field: PUSHED_AT, direction: DESC
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
			pageInfo {
				endCursor
				hasNextPage
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
		   dependencyGraphManifests(withDependencies: true, first: $dependencyLimit) {
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
        `
	let param = {
	  organisation: organisation,
      numOfPages: numOfPages,
      repoCursor: repoCursor,
	  dependencyLimit: 10
    }

  return queryGraphQL(query, param)
}

/**
 *
 * @param organisation organisation name
 * @param repoName repository name
 * @param defaultBranch default branch name
 * @param manifestPaths manifest paths, must be relative to the repository root, must have a length of less than 10
 * @returns return at most 10 manifests objects
 */
export async function queryRepoManifest(organisation: string, repoName: string, defaultBranch:string, manifestPaths: string[]) : Promise<GraphQlQueryResponseData> {

	// https://graphql.org/learn/queries/#inline-fragments
	// rev-parse compatible path
	// valid manifest file name: package.json, yarn.lock, requirements.txt and others

	// Changing query inside the query is not safe, due to graphql injections, but since we are not doing any mutations, this should be fine

	if (manifestPaths.length > 10) {
		manifestPaths = manifestPaths.slice(0, 10)
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

	return queryGraphQL(query, param)
  }
