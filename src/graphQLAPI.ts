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

export type GraphResponse = {
    errors?: {
        message: string }[]
	rateLimit: {
		cost: number,
		remaining: number,
		resetAt: string

	},
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
    errors?: {
        message: string }[]
	rateLimit: {
		cost: number,
		remaining: number,
		resetAt: string

	},
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

export async function queryGraphQL(query: string, param: any) : Promise<GraphQlQueryResponseData> {
	const graphqlWithAuth = graphql.defaults({
	  headers: {
		authorization: `token TOKEN`,
		accept: `application/vnd.github.hawkgirl-preview+json`,
	  },
	});
	let response: GraphQlQueryResponseData = graphqlWithAuth(query, param)
	return response
}


	export async function queryRepositories(organisation: string, repoCursor: string | null) : Promise<GraphQlQueryResponseData> {
		let query: string =
			`
			query OrgRepos($queryString: String!) {
				rateLimit {
				  cost
				  remaining
				  resetAt
				}
				organization(login: $queryString) {
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
				queryString: organisation,
				numOfPages: 100,
				repoCursor: repoCursor,
			}
  		return queryGraphQL(query, param)

	}
export async function queryDependencies(organisation: string, numOfPages: number, repoCursor: string | null) : Promise<GraphQlQueryResponseData> {

  // refer to this on how to query different branches/ref,
  // https://stackoverflow.com/questions/51504760/how-to-get-all-repos-that-contain-a-certain-branch-on-githubs-graphql-api
  // TODO: limit to default branch, current setup no working
  let query: string =
    `
	query orgRepos($queryString: String!, $numOfPages: Int!, $repoCursor: String, $dependencyLimit: Int!) {
		rateLimit{
		   cost
		   remaining
		   resetAt
		   }
		 organization(login: $queryString) {
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
      queryString: organisation,
      numOfPages: numOfPages,
      repoCursor: repoCursor,
	  dependencyLimit: 10
    }

  return queryGraphQL(query, param)
}
