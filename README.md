# Organisation Crawler

The organisation Crawler uses the [GitHub GraphQL API](https://docs.GitHub.com/en/GraphQL) to extract all of a GitHub organisation's repositories and their dependencies. The current version of the dependencies are found using `DependencyGraphManifest` GraphQL object. The latest versions of the dependencies are found using calls to the npm API.

The information is outputted to a `response.json` file which has a [schema](#output-schema) .

The current goal is to have the crawler run onn the the frontend

## TODO
### Improvements
- [x] Pagination
- [x] Rate Limiter for GitHub
- [ ] Default Branch
- [x] Error handling
  - [x] invalid or expired token
- [ ] Fetch all dependencies, currently cut off limit is 250 for each manifest file
- [ ] Slack alert when a dependency is two majors behind
`
#### Potential
- [ ] Dedicated GraphQL file
- [ ] Store results into into a database

## Package Managers support

* JavaScript
* Python

## Repository Setup

Before you commit, please configure pre-commit with:

`pre-commit install`

Now, every time you commit, it will run hooks to fix various styling and linting problem.

### Running pre-commit hooks manually

`pre-commit run --all-files`

### Skipping pre-commit hooks

Please avoid doing this at all cost.

`git commit -n -m "Your commit message"`

The `-n` allows you to skip git hooks.

## Usage

- [Create a personal access token](https://docs.GitHub.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token) on GitHub.
- Put your token inside the a .env file,  and add to .gitignore
- run `npm install` to install the necessary dependencies
- run `tsc -w` or `npx tsc -w` (if npm is not installed globally on your device) to let TypeScript compile the code and watch for changes. This will create the build folder
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

## Execute jest test faster

Run a single file only `npm run test <PATHTOFILE>`

Use the flag `--onlyFailures` to only run failed tests in the previous execution `npm run test --onlyFailures`


## Limitations
The dashboard depends on [Dependency Graph manifest](https://docs.github.com/en/graphql/reference/objects#dependencygraphmanifest), which has some limitations, for example it cannot detect dependencies which:
* Javascript:
  * use `"foo": "github:user/repo`
  * use `"foo": "user/repo"`
  * use `"foo": "fileSystemPath"`
* Python
  * use `foo fileSystemPath`
