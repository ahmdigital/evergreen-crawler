# Organisation Crawler

The organisation Crawler uses the [GitHub GraphQL API](https://docs.github.com/en/graphql) to extract all of a GitHub organisation's repositories and their dependencies. The current version of the dependencies are found using `DependencyGraphManifest` graphQL object. The latest versions of the dependencies are found using calls to the npm api.

The information is outputted to a `response.json` file which has a [schema](#output-schema) . 

The current goal is to have the crawler run onn the the frontend 

## TODO
### Improvements
- [x] Pagination
- [ ] Rate Limiter for github
- [ ] Default Branch
- [ ] Error handling
- [ ] Dedicated Graphql file
- [ ] Slack alert if a once a dependency is two majors behind
`
#### Potential 
- [ ] Store results into into a database

## Package Managers support

* Javascript
* Python

## Usage

- [Create a personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token) on GitHub.
- Put your token inside the a .env file,  and add to .gitignore 
- run `npm install` to install the necessary dependencies
- run `tsc -w` or `npx tsc -w` (if npm is not installed globally on your device) to let typescript compile the code and watch for changes. This will create the build folder
- run `node ./build/index.js` in a new terminal tab to execute the crawler

If you want to play around, simply edit the code (tsc will compile it automatically as long as `tsc -w` is running), finally run `node ./build/index.js` again.


## Output schema

```
RepoMap: Map<ID, Object> = {
    ID: {
        name: ID= "NAME",
        version: SemVer = VERSION,
        link: string = "LINK",
        internal: bool = IS_INTERNAL
        archived: bool = IS_ARCHIVED
    },
    ...
}
DependencyList: Object[] = [
    {
        id: ID = ID,
        dependencies: [int, SemVer] = [
            [ID, VERSION],
            ...
        ]
    },
    ...
]

```
