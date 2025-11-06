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
	let invalidSections: string;
	let smallerSections: string;
	let invalidJson: string;
	let nocoursesfolder: string;
	let campus: string;

	before(async function () {
		// This block runs once and loads the datasets.
		sections = await getContentFromArchives("pair.zip");
		emptyDataset = await getContentFromArchives("empty.zip");
		singleCourse = await getContentFromArchives("single.zip");
		outsideFolder = await getContentFromArchives("outsideFolder.zip");
		invalidSections = await getContentFromArchives("invalidsections.zip");
		smallerSections = await getContentFromArchives("ihate310.zip");
		invalidJson = await getContentFromArchives("invalidjson.zip");
		nocoursesfolder = await getContentFromArchives("nocoursestest.zip");
		campus = await getContentFromArchives("campus.zip");

		// Just in case there is anything hanging around from a previous run of the test suite
		await clearDisk();
	});

	describe("AddDataset", function () {
		beforeEach(async function () {
			await clearDisk();
			facade = new InsightFacade();
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

		it("should reject on an invalid zip file", async function () {
			try {
				await facade.addDataset("validid", invalidSections, InsightDatasetKind.Sections);
				expect.fail("read invalid zip file");
			} catch (err) {
				expect(err).to.be.an.instanceOf(InsightError);
			}
		});

		it("should reject on an invalid dataset string", async function () {
			try {
				await facade.addDataset("validid", "hi", InsightDatasetKind.Sections);
				expect.fail("invalid dataset string");
			} catch (err) {
				expect(err).to.be.an.instanceOf(InsightError);
			}
		});

		it("should reject on a dataset with a folder not named courses", async function () {
			try {
				await facade.addDataset("validid", nocoursesfolder, InsightDatasetKind.Sections);
				expect.fail("No courses folder found in file");
			} catch (err) {
				expect(err).to.be.an.instanceOf(InsightError);
			}
		});

		it("should reject with a dataset w an invalid json file", async function () {
			try {
				await facade.addDataset("validid", invalidJson, InsightDatasetKind.Sections);
			} catch (err) {
				expect(err).to.be.an.instanceOf(InsightError);
			}
		});

		it("should reject with an empty dataset id", async function () {
			try {
				await facade.addDataset("", sections, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.an.instanceOf(InsightError);
			}
		});

		it("should reject with an dataset id that contains underscore", async function () {
			try {
				await facade.addDataset("a_ ", sections, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.an.instanceOf(InsightError);
			}
		});

		it("should reject with an dataset id that is only an underscore", async function () {
			try {
				await facade.addDataset("_", sections, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.an.instanceOf(InsightError);
			}
		});

		it("should reject with an all whitepaces id", async function () {
			try {
				await facade.addDataset("   ", sections, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.an.instanceOf(InsightError);
			}
		});

		it("should reject with a repeated id", async function () {
			try {
				await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
				await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.an.instanceOf(InsightError);
			}
		});

		it("should accept a dataset with a new unique id", async function () {
			try {
				const result = await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
				// expected behaviour, fine
				expect(result).to.deep.equal(["ubc"]);
			} catch {
				expect.fail("Was not expecting an error");
			}
		});

		it("should accept a dataset with a new unique id with already existing datasets", async function () {
			try {
				await facade.addDataset("sfu", sections, InsightDatasetKind.Sections);
				const result = await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
				// expected behaviour, fine
				expect(result).to.deep.equal(["sfu", "ubc"]);
			} catch {
				expect.fail("Was not expecting an error");
			}
		});

		// add more tests for adding multiple datasets
		it("should reject a dataset with a repeated id with already existing datasets", async function () {
			try {
				await facade.addDataset("sfu", sections, InsightDatasetKind.Sections);
				await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
				await facade.addDataset("sfu", sections, InsightDatasetKind.Sections);
				// expected behaviour, fine
				expect.fail("Should've thrown");
			} catch (err) {
				expect(err).to.be.an.instanceOf(InsightError);
			}
		});

		// TODO: implement test case with a different valid dataset
		it("should reject a dataset with a repeat id from another dataset w same id ", async function () {
			try {
				await facade.addDataset("sfu", smallerSections, InsightDatasetKind.Sections);
				await facade.addDataset("sfu", sections, InsightDatasetKind.Sections);
				expect.fail("Should reject on repeated id even with diff datasets");
				// expected behaviour, fine
				// expect(result).to.have.deep.members(["ubc", "sfu"]);
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should accept on with a unique id from another dataset ", async function () {
			try {
				await facade.addDataset("sfu", smallerSections, InsightDatasetKind.Sections);
				const result = await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
				expect(result).to.have.deep.members(["sfu", "ubc"]);
				// expected behaviour, fine
				// expect(result).to.have.deep.members(["ubc", "sfu"]);
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should accept adding a rooms dataset", async function () {
			try {
				const result = await facade.addDataset("campus", campus, InsightDatasetKind.Rooms);
				expect(result).to.have.deep.members(["campus"]);
				expect(result).to.be.lengthOf(1);
				expect(result[0]).to.be.equal("campus");
			} catch (err) {
				expect.fail("Error not expected");
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

		it("should reject on an invalid id w no datasets added", async function () {
			try {
				await facade.removeDataset("");
				expect.fail("shouldve failed");
			} catch (err) {
				expect(err).to.be.an.instanceOf(InsightError);
			}
		});

		it("should reject on an invalid id w underscore and space w no datasets added", async function () {
			try {
				await facade.removeDataset(" a_");
				expect.fail("shouldve failed");
			} catch (err) {
				expect(err).to.be.an.instanceOf(InsightError);
			}
		});

		it("should reject on a valid id referring to a non existent dataset", async function () {
			try {
				await facade.addDataset("sfu", sections, InsightDatasetKind.Sections);
				await facade.removeDataset("ubc");
				expect.fail("Should have thrown an error!");
			} catch (err) {
				expect(err).to.be.an.instanceOf(NotFoundError);
			}
		});

		it("should reject on a valid id referring to a previously deleted dataset", async function () {
			try {
				await facade.addDataset("sfu", sections, InsightDatasetKind.Sections);
				await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
				await facade.removeDataset("ubc");
				await facade.removeDataset("ubc");
				expect.fail("Should have thrown an error!");
			} catch (err) {
				expect(err).to.be.an.instanceOf(NotFoundError);
			}
		});

		it("should accept on an id referring to one existing dataset", async function () {
			try {
				await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
				const result = await facade.removeDataset("ubc");
				expect(result).to.be.equal("ubc");
			} catch {
				expect.fail("should've passed");
			}
		});

		it("should accept on an id referring to multiple existing dataset", async function () {
			try {
				await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
				await facade.addDataset("sfu", sections, InsightDatasetKind.Sections);
				const result = await facade.removeDataset("ubc");
				expect(result).to.be.equal("ubc");
			} catch {
				expect.fail("should've passed");
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

		it("should accept on no datasets added", async function () {
			try {
				const result = await facade.listDatasets();
				expect(result).to.deep.members([]);
			} catch {
				expect.fail("should've passed");
			}
		});

		it("should accept on one previously existing dataset", async function () {
			try {
				await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
				const result = await facade.listDatasets();
				expect(result).to.deep.equal([{ id: "ubc", kind: InsightDatasetKind.Sections, numRows: 64612 }]);
			} catch {
				expect.fail("should've passed");
			}
		});

		it("should accept on multiple existing datasets", async function () {
			try {
				await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
				await facade.addDataset("sfu", sections, InsightDatasetKind.Sections);
				const result = await facade.listDatasets();
				expect(result).to.deep.equal([
					{ id: "ubc", kind: InsightDatasetKind.Sections, numRows: 64612 },
					{ id: "sfu", kind: InsightDatasetKind.Sections, numRows: 64612 },
				]);
			} catch {
				expect.fail("should've passed");
			}
		});

		it("should list one rooms dataset", async function () {
			try {
				await facade.addDataset("campus", campus, InsightDatasetKind.Rooms);
				const result = await facade.listDatasets();
				expect(result).to.deep.equal([{ id: "campus", kind: InsightDatasetKind.Rooms, numRows: 364 }]);
			} catch (error) {
				expect.fail("should've passed");
			}
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
				expect(result).to.deep.members(expected);
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
				} else {
					expect.fail("Unexpected error");
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
		it("[valid/noresultsquery.json] Select all ADHD courses and avg", checkQuery);
		it(
			"[valid/selectCPSCCoursesWithAvg_85InIncreasingOrder.json] Select CPSC sections with avg > 85 in increasing order",
			checkQuery
		);
		it("[valid/testDoubleAsteriskWildcard.json] Query with a double asterisk wildcard", checkQuery);
		it("[valid/queryWithAOneAsteriskWildcard(Left).json] Query with a one asterisk wildcard (left)", checkQuery);
		it("[valid/queryWithAOneAsteriskWildcard(Right).json] Query with a one asterisk wildcard (right)", checkQuery);
		it("[valid/queryWithAnExactMatchWildcard.json] Query with an exact match wildcard", checkQuery);
		it("[valid/testAND.json] Test AND", checkQuery);
		it("[valid/testEQ.json] Test EQ", checkQuery);
		it("[valid/testGT.json] Test GT", checkQuery);
		it("[valid/testLT.json] Test LT", checkQuery);
		it("[valid/testNOT.json] Test NOT", checkQuery);
		it("[valid/testOR.json] Test OR", checkQuery);
		it("[valid/complexquery.json] Test complex query", checkQuery);
		it("[valid/testANDWithGTAndEQ(InvalidInterval).json] Test and + gt + eq (no results)", checkQuery);
		it("[valid/testANDWithGTAndEQ(ValidInterval).json] Test and + gt + eq", checkQuery);
		it("[valid/testANDWithGTAndLT(InvalidInterval).json] Test and + gt + lt (no results)", checkQuery);
		it("[valid/testANDWithGTAndLT(ValidInterval).json] Test and + gt + lt", checkQuery);
		it("[valid/testANDWithGTAndLTAndEQ(InvalidInterval).json] Test and + gt + lt + eq (no results)", checkQuery);
		it("[valid/testANDWithGTAndLTAndEQ(ValidInterval).json] Test and + gt + lt + eq", checkQuery);
		it("[valid/testANDWithLTAndEQ(InvalidInterval).json] Test and + lt + eq (no results)", checkQuery);
		it("[valid/testANDWithLTAndEQ(ValidInterval).json] Test and + lt + eq", checkQuery);
		it("[valid/testORWithGTAndEQ.json] Test or + gt + eq", checkQuery);
		it("[valid/testORWithGTAndLT.json] Test or + gt + lt", checkQuery);
		it("[valid/testORWithLTAndEQ.json] Test or + lt + eq", checkQuery);
		it("[valid/testORWithLTAndGTAndEQ.json] Test or + lt + gt + eq", checkQuery);

		// invalid queries
		it("[invalid/invalid.json] Query missing WHERE", checkQuery);
		it("[invalid/middle_asterisk.json] Can't have asterisk in the middle", checkQuery);
		it("[invalid/asterisk_only.json] Can't have asterisk only", checkQuery);
		it("[invalid/missing_options.json] Query missing OPTIONS", checkQuery);
		it("[invalid/missing_columns.json] Query missing COLUMNS", checkQuery);
		it("[invalid/empty_or.json] Empty OR statement", checkQuery);
		it("[invalid/empty_and.json] Empty AND statement", checkQuery);
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
		it("[invalid/too_many_keys_eq.json] EQ has too many keys", checkQuery);
		it("[invalid/empty_gt.json] Empty GT statement", checkQuery);
		it("[invalid/invalid_key_gt.json] GT has invalid key type", checkQuery);
		it("[invalid/too_many_key_gt.json] GT has too many keys", checkQuery);
		it("[invalid/invalid_key_not.json] NOT has invalid filter key", checkQuery);
		it("[invalid/invalid_key_where.json] Invalid key in WHERE", checkQuery);
		it("[invalid/invalid_key_columns.json] Invalid key in COLUMNS", checkQuery);
		it("[invalid/invalidstringinput.json] Query with invalid input", checkQuery);
		it("[invalid/toomanyresults.json] Query that results in ResultTooLargeError", checkQuery);
		it("[invalid/missingcols.json] Query missing COLUMNS", checkQuery);
		it("[invalid/invalidWilcard(AsteriskInMiddle).json] Query with an invalid wildcard (* in middle)", checkQuery);
		it("[invalid/invalidmkey.json] Query with an invalid mkey", checkQuery);
		it("[invalid/invalidskey.json] Query with an invalid skey", checkQuery);
		it("[invalid/querywithnofilter.json] Query without a filter", checkQuery);
		it("[invalid/querywithnokey.json] Query with no key", checkQuery);
		it("[invalid/querywithinvalidorder.json] Query with invalid order", checkQuery);
		it("[invalid/querywithmultiplekeys.json] Query with multiples key", checkQuery);
		it("[invalid/testOrderNotInColumns.json] Test Order key not in cols", checkQuery);
		it("[invalid/testWith2Datasets.json] Test for query referencing 2 datasets", checkQuery);
		it("[invalid/invalidKeyWithUnderscore.json] Invalid Key with underscore", checkQuery);
	});
});
