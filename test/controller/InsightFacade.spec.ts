import {
	IInsightFacade,
	InsightDatasetKind,
	InsightError,
	InsightResult,
	NotFoundError,
	ResultTooLargeError,
} from "../../src/controller/IInsightFacade";
import InsightFacade from "../../src/controller/InsightFacade";
import { clearDisk, getContentFromArchives, loadTestQuery } from "../TestUtil";

import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";

use(chaiAsPromised);

export interface ITestQuery {
	title?: string;
	input: unknown;
	errorExpected: boolean;
	expected: any;
}

describe("InsightFacade", function () {
	let facade: IInsightFacade;

	// Declare datasets used in tests. You should add more datasets like this!
	let sections: string;
	let emptyDataset: string;
	let singleCourse: string;
	let outsideFolder: string;

	before(async function () {
		// This block runs once and loads the datasets.
		sections = await getContentFromArchives("pair.zip");
		emptyDataset = await getContentFromArchives("empty.zip");
		singleCourse = await getContentFromArchives("single.zip");
		outsideFolder = await getContentFromArchives("outsideFolder.zip");

		// Just in case there is anything hanging around from a previous run of the test suite
		await clearDisk();
	});

	describe("AddDataset", function () {
		beforeEach(async function () {
			await clearDisk();
			facade = new InsightFacade();
		});

		it("should reject with an empty dataset id", async function () {
			// Read the "Free Mutant Walkthrough" in the spec for tips on how to get started!
			try {
				await facade.addDataset("", sections, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject with whitespace only dataset id", async function () {
			try {
				await facade.addDataset(" ", sections, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject with underscore only dataset id", async function () {
			try {
				await facade.addDataset("_", sections, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject with dataset id containing underscore", async function () {
			try {
				await facade.addDataset("h_i", sections, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should accept valid dataset id", async function () {
			try {
				const result = await facade.addDataset("idk", sections, InsightDatasetKind.Sections);
				expect(result).to.be.lengthOf(1);
				expect(result[0]).to.be.equal("idk");
			} catch (_err) {
				expect.fail("Error not expected.");
			}
		});

		it("should accept using diff ids", async function () {
			try {
				await facade.addDataset("one", singleCourse, InsightDatasetKind.Sections);
			} catch (_err) {
				expect.fail("Error not expected");
			}
			try {
				const result = await facade.addDataset("two", sections, InsightDatasetKind.Sections);
				expect(result).to.be.lengthOf(2);
				expect(result[0]).to.be.equal("one");
				expect(result[1]).to.be.equal("two");
			} catch (_e) {
				expect.fail("Error not expected");
			}
		});

		it("should reject using same id", async function () {
			try {
				await facade.addDataset("twin", sections, InsightDatasetKind.Sections);
			} catch (_err) {
				expect.fail("Error not expected");
			}
			try {
				await facade.addDataset("twin", singleCourse, InsightDatasetKind.Sections);
			} catch (e) {
				expect(e).to.be.instanceOf(InsightError);
			}
		});

		it("should reject adding empty dataset", async function () {
			try {
				await facade.addDataset("empty", emptyDataset, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should accept dataset with only one course", async function () {
			try {
				const result = await facade.addDataset("single", singleCourse, InsightDatasetKind.Sections);
				expect(result).to.be.lengthOf(1);
				expect(result[0]).to.be.equal("single");
			} catch (_err) {
				expect.fail("Error not expected.");
			}
		});

		it("should reject if course is not in courses folder", async function () {
			try {
				await facade.addDataset("outside", outsideFolder, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject adding non-base64 string", async function () {
			try {
				await facade.addDataset("vomit", "SGVsbG8$V29ybGQ=", InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});
	});

	describe("RemoveDataset", function () {
		beforeEach(async function () {
			await clearDisk();
			facade = new InsightFacade();
		});

		it("should accept removing one dataset", async function () {
			const list = await facade.addDataset("idk", sections, InsightDatasetKind.Sections);
			expect(list).to.be.lengthOf(1);
			expect(list[0]).to.be.equal("idk");
			try {
				const result = await facade.removeDataset("idk");
				expect(result).to.be.equal("idk");
				const datasets = await facade.listDatasets();
				expect(datasets).to.be.lengthOf(0);
			} catch (_err) {
				expect.fail("Error not expected.");
			}
		});

		it("should reject removing dataset using empty id", async function () {
			const list = await facade.addDataset("idk", sections, InsightDatasetKind.Sections);
			expect(list).to.be.lengthOf(1);
			expect(list[0]).to.be.equal("idk");
			try {
				await facade.removeDataset("");
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject removing dataset using whitespace only id", async function () {
			const list = await facade.addDataset("idk", sections, InsightDatasetKind.Sections);
			expect(list).to.be.lengthOf(1);
			expect(list[0]).to.be.equal("idk");
			try {
				await facade.removeDataset(" ");
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject removing dataset using underscore only id", async function () {
			const list = await facade.addDataset("idk", sections, InsightDatasetKind.Sections);
			expect(list).to.be.lengthOf(1);
			expect(list[0]).to.be.equal("idk");
			try {
				await facade.removeDataset("_");
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject removing using id with no match", async function () {
			const list = await facade.addDataset("idk", sections, InsightDatasetKind.Sections);
			expect(list).to.be.lengthOf(1);
			expect(list[0]).to.be.equal("idk");
			try {
				await facade.removeDataset("ik");
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(NotFoundError);
			}
		});
	});

	describe("listDatasets", function () {
		beforeEach(async function () {
			await clearDisk();
			facade = new InsightFacade();
		});

		it("should list one dataset", async function () {
			await facade.addDataset("idk", sections, InsightDatasetKind.Sections);
			const datasets = await facade.listDatasets();
			expect(datasets).to.be.length(1);
		});
	});

	describe("PerformQuery", function () {
		/**
		 * Loads the TestQuery specified in the test name and asserts the behaviour of performQuery.
		 *
		 * Note: the 'this' parameter is automatically set by Mocha and contains information about the test.
		 */
		async function checkQuery(this: Mocha.Context): Promise<void> {
			if (!this.test) {
				throw new Error(
					"Invalid call to checkQuery." +
					"Usage: 'checkQuery' must be passed as the second parameter of Mocha's it(..) function." +
					"Do not invoke the function directly."
				);
			}
			// Destructuring assignment to reduce property accesses
			const { input, expected, errorExpected } = await loadTestQuery(this.test.title);
			let result: InsightResult[] = []; // dummy value before being reassigned
			try {
				result = await facade.performQuery(input);
				if (errorExpected) {
					expect.fail("Error expected.");
				}
				expect(result).to.deep.equal(expected);
			} catch (err) {
				if (!errorExpected) {
					expect.fail(`performQuery threw unexpected error: ${err}`);
				}
				// TODO: replace this failing assertion with your assertions. You will need to reason about the code in this function
				// to determine what to put here :)
				if (expected === "InsightError") {
					expect(err).to.be.instanceOf(InsightError);
				} else if (expected === "ResultTooLargeError") {
					expect(err).to.be.instanceOf(ResultTooLargeError);
				}
			}
		}

		before(async function () {
			facade = new InsightFacade();

			// Add the datasets to InsightFacade once.
			// Will *fail* if there is a problem reading ANY dataset.
			const loadDatasetPromises: Promise<string[]>[] = [
				facade.addDataset("sections", sections, InsightDatasetKind.Sections),
			];

			try {
				await Promise.all(loadDatasetPromises);
			} catch (err) {
				throw new Error(`In PerformQuery Before hook, dataset(s) failed to be added. \n${err}`);
			}
		});

		after(async function () {
			await clearDisk();
		});

		// Examples demonstrating how to test performQuery using the JSON Test Queries.
		// The relative path to the query file must be given in square brackets.

		// valid queries
		it("[valid/simple.json] SELECT dept, avg WHERE avg > 97", checkQuery);
		it("[valid/complex.json] Test complex query with multiple logic statements", checkQuery);
		it("[valid/test_lt.json] Test LT logic", checkQuery);
		it("[valid/test_eq.json] Test EQ logic", checkQuery);
		it("[valid/test_and.json] Test AND logic", checkQuery);
		it("[valid/test_or.json] Test OR logic", checkQuery);
		it("[valid/test_not.json] Test NOT logic", checkQuery);
		it("[valid/asterisk_start.json] Test asterisk at start of input string", checkQuery);
		it("[valid/asterisk_end.json] Test asterisk at end of input string", checkQuery);
		it("[valid/two_asterisk.json] Test asterisk at start and end of input string", checkQuery);
		it("[valid/empty.json] Test query with no results", checkQuery);
		it("[valid/all_columns.json] Test getting all columns", checkQuery);
		it("[valid/missing_order.json] ORDER is missing", checkQuery);

		// invalid queries
		it("[invalid/invalid.json] Query missing WHERE", checkQuery);
		it("[invalid/middle_asterisk.json] Can't have asterisk in the middle", checkQuery);
		it("[invalid/asterisk_only.json] Can't have asterisk only", checkQuery);
		it("[invalid/missing_options.json] Query missing OPTIONS", checkQuery);
		it("[invalid/missing_columns.json] Query missing COLUMNS", checkQuery);
		it("[invalid/empty_or.json] Empty OR statement", checkQuery);
		it("[invalid/empty_and.json] Empty AND statement", checkQuery);
		it("[invalid/complex_invalid.json] Test complex query with invalid keys", checkQuery);
		it("[invalid/empty_not.json] Empty NOT statement", checkQuery);
		it("[invalid/order_not_in_columns.json] ORDER is not in COLUMNS", checkQuery);
		it("[invalid/empty.json] Literally nothing", checkQuery);
		it("[invalid/empty_columns.json] COLUMNS is empty", checkQuery);
		it("[invalid/too_many_key_not.json] NOT has too many keys", checkQuery);
		it("[invalid/empty_lt.json] Empty LT statement", checkQuery);
		it("[invalid/invalid_key_lt.json] LT has invalid key type", checkQuery);
		it("[invalid/empty_is.json] Empty IS statement", checkQuery);
		it("[invalid/invalid_key_lt.json] IS has invalid key type", checkQuery);
		it("[invalid/empty_eq.json] Empty EQ statement", checkQuery);
		it("[invalid/invalid_key_eq.json] EQ has invalid key type", checkQuery);
		it("[invalid/too_many_key_is.json] IS has too many keys", checkQuery);
		it("[invalid/too_many_key_lt.json] LT has too many keys", checkQuery);
		it("[invalid/too_many_keys.json] EQ has too many keys", checkQuery);
		it("[invalid/empty_gt.json] Empty GT statement", checkQuery);
		it("[invalid/invalid_key_gt.json] GT has invalid key type", checkQuery);
		it("[invalid/too_many_key_gt.json] GT has too many keys", checkQuery);
		it("[invalid/invalid-key_not.json] NOT has invalid filter key", checkQuery);
		it("[invalid/invalid_key_where.json] Invalid key in WHERE", checkQuery);
		it("[invalid/invalid_key_columns.json] Invalid key in COLUMNS", checkQuery);
	});
});
