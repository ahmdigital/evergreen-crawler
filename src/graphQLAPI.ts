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

export async function queryGraphQL(organisation: string, accessToken: string, repoCursor: string | null) : Promise<GraphQlQueryResponseData> {
  
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
	query orgRepos($queryString: String!, $numOfPages: Int!, $repoCursor: String, $dependencyLimit: Int!) {
		rateLimit{
		   cost
		   remaining
		   resetAt
		   }
		 organization(login: $queryString) {
		 id
		 repositories(first: $numOfPages, after: $repoCursor , orderBy: {field: CREATED_AT, direction: ASC
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
        `,
    {
      queryString: organisation,
      numOfPages: 5,
      repoCursor: repoCursor,
	  dependencyLimit: 10
    }
  )

  return response
}