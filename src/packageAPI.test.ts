import { parsePythonPackageVersion } from "./packageAPI";

test("Parse Python package version 1", async () => {
	const res = parsePythonPackageVersion("1.1.post7")

	console.log(res)

	expect(res.first).toBe(1)
	expect(res.rest).toStrictEqual([1, 7])
	expect(res.isPrerelease).toBe(false)
})

test("Parse Python package version 2", async () => {
	const res = parsePythonPackageVersion("14.19a34")

	console.log(res)

	expect(res.first).toBe(14)
	expect(res.rest).toStrictEqual([19])
	expect(res.isPrerelease).toBe(true)
})

test("Parse Python package version 3", async () => {
	const res = parsePythonPackageVersion("51.4.dev91.67")

	console.log(res)
	
	expect(res.first).toBe(51)
	expect(res.rest).toStrictEqual([4, 91, 67])
	expect(res.isPrerelease).toBe(true)
})