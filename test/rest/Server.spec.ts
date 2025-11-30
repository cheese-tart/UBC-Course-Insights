import { expect } from "chai";
import request from "supertest";
import { StatusCodes } from "http-status-codes";
import Server from "../../src/rest/Server";
import { clearDisk, getContentFromArchives } from "../TestUtil";
import { InsightDatasetKind } from "../../src/controller/IInsightFacade";

describe("Server Integration Tests", function () {
	let server: Server;
	const port = 4321;

	// Test datasets
	let sectionsDataset: string;

	before(async function () {
		// Load test datasets
		sectionsDataset = await getContentFromArchives("single.zip");
	});

	beforeEach(async function () {
		// Clear disk and create fresh server instance before each test
		await clearDisk();
		server = new Server(port);
		await server.start();
	});

	afterEach(async function () {
		// Stop server after each test
		if (server) {
			await server.stop();
		}
		await clearDisk();
	});

	describe("PUT /dataset/:id/:kind - Adding a dataset", function () {
		it("should successfully add a sections dataset", async function () {
			const datasetId = "testSections";
			const datasetKind = InsightDatasetKind.Sections;
			const buffer = Buffer.from(sectionsDataset, "base64");

			const res = await request(server.getApp())
				.put(`/dataset/${datasetId}/${datasetKind}`)
				.set("Content-Type", "application/zip")
				.send(buffer);

			expect(res.status).to.equal(StatusCodes.OK);
			expect(res.body).to.have.property("result");
			expect(res.body.result).to.be.an("array");
			expect(res.body.result).to.include(datasetId);
		});

		it("should return error for invalid dataset kind", async function () {
			const datasetId = "testInvalid";
			const invalidKind = "invalid";
			const buffer = Buffer.from(sectionsDataset, "base64");

			const res = await request(server.getApp())
				.put(`/dataset/${datasetId}/${invalidKind}`)
				.set("Content-Type", "application/zip")
				.send(buffer);

			expect(res.status).to.equal(StatusCodes.BAD_REQUEST);
			expect(res.body).to.have.property("error");
		});

		it("should return error for duplicate dataset ID", async function () {
			const datasetId = "duplicate";
			const buffer = Buffer.from(sectionsDataset, "base64");

			// Add dataset first time
			await request(server.getApp())
				.put(`/dataset/${datasetId}/${InsightDatasetKind.Sections}`)
				.set("Content-Type", "application/zip")
				.send(buffer);

			// Try to add same dataset again
			const res = await request(server.getApp())
				.put(`/dataset/${datasetId}/${InsightDatasetKind.Sections}`)
				.set("Content-Type", "application/zip")
				.send(buffer);

			expect(res.status).to.equal(StatusCodes.BAD_REQUEST);
			expect(res.body).to.have.property("error");
		});
	});

	describe("DELETE /dataset/:id - Removing a dataset", function () {
		it("should successfully remove an existing dataset", async function () {
			const datasetId = "testRemove";
			const buffer = Buffer.from(sectionsDataset, "base64");

			// First add a dataset
			await request(server.getApp())
				.put(`/dataset/${datasetId}/${InsightDatasetKind.Sections}`)
				.set("Content-Type", "application/zip")
				.send(buffer);

			// Then remove it
			const res = await request(server.getApp()).delete(`/dataset/${datasetId}`);

			expect(res.status).to.equal(StatusCodes.OK);
			expect(res.body).to.have.property("result");
			expect(res.body.result).to.equal(datasetId);
		});

		it("should return 404 for non-existent dataset", async function () {
			const nonExistentId = "nonexistent";

			const res = await request(server.getApp()).delete(`/dataset/${nonExistentId}`);

			expect(res.status).to.equal(StatusCodes.NOT_FOUND);
			expect(res.body).to.have.property("error");
		});

		it("should remove dataset and verify it's gone from list", async function () {
			const datasetId = "testVerifyRemove";
			const buffer = Buffer.from(sectionsDataset, "base64");

			// Add dataset
			await request(server.getApp())
				.put(`/dataset/${datasetId}/${InsightDatasetKind.Sections}`)
				.set("Content-Type", "application/zip")
				.send(buffer);

			// Verify it's in the list
			let listRes = await request(server.getApp()).get("/datasets");
			expect(listRes.body.result).to.be.an("array");
			expect(listRes.body.result.some((d: any) => d.id === datasetId)).to.be.true;

			// Remove it
			await request(server.getApp()).delete(`/dataset/${datasetId}`);

			// Verify it's no longer in the list
			listRes = await request(server.getApp()).get("/datasets");
			expect(listRes.body.result).to.be.an("array");
			expect(listRes.body.result.some((d: any) => d.id === datasetId)).to.be.false;
		});
	});

	describe("GET /datasets - Getting datasets", function () {
		it("should return empty array when no datasets are added", async function () {
			const res = await request(server.getApp()).get("/datasets");

			expect(res.status).to.equal(StatusCodes.OK);
			expect(res.body).to.have.property("result");
			expect(res.body.result).to.be.an("array");
			expect(res.body.result).to.be.empty;
		});

		it("should return list with one dataset after adding", async function () {
			const datasetId = "testGet";
			const buffer = Buffer.from(sectionsDataset, "base64");

			// Add a dataset
			await request(server.getApp())
				.put(`/dataset/${datasetId}/${InsightDatasetKind.Sections}`)
				.set("Content-Type", "application/zip")
				.send(buffer);

			// Get datasets
			const res = await request(server.getApp()).get("/datasets");

			expect(res.status).to.equal(StatusCodes.OK);
			expect(res.body).to.have.property("result");
			expect(res.body.result).to.be.an("array");
			expect(res.body.result).to.have.length(1);
			expect(res.body.result[0]).to.have.property("id", datasetId);
			expect(res.body.result[0]).to.have.property("kind", InsightDatasetKind.Sections);
			expect(res.body.result[0]).to.have.property("numRows");
			expect(res.body.result[0].numRows).to.be.a("number");
		});
	});

	describe("POST /query - Posting a query", function () {
		it("should successfully execute a query on sections dataset", async function () {
			const datasetId = "queryTest";
			const buffer = Buffer.from(sectionsDataset, "base64");

			// Add a dataset first
			await request(server.getApp())
				.put(`/dataset/${datasetId}/${InsightDatasetKind.Sections}`)
				.set("Content-Type", "application/zip")
				.send(buffer);

			// Execute a query
			const query = {
				WHERE: {
					LT: {
						[`${datasetId}_avg`]: 100,
					},
				},
				OPTIONS: {
					COLUMNS: [`${datasetId}_uuid`, `${datasetId}_id`, `${datasetId}_avg`],
				},
			};

			const res = await request(server.getApp()).post("/query").set("Content-Type", "application/json").send(query);

			expect(res.status).to.equal(StatusCodes.OK);
			expect(res.body).to.have.property("result");
			expect(res.body.result).to.be.an("array");
			// Verify result structure
			if (res.body.result.length > 0) {
				expect(res.body.result[0]).to.have.property(`${datasetId}_uuid`);
				expect(res.body.result[0]).to.have.property(`${datasetId}_id`);
				expect(res.body.result[0]).to.have.property(`${datasetId}_avg`);
			}
		});

		it("should return error for query on non-existent dataset", async function () {
			const query = {
				WHERE: {},
				OPTIONS: {
					COLUMNS: ["nonexistent_uuid", "nonexistent_id"],
				},
			};

			const res = await request(server.getApp()).post("/query").set("Content-Type", "application/json").send(query);

			expect(res.status).to.equal(StatusCodes.BAD_REQUEST);
			expect(res.body).to.have.property("error");
		});

		it("should return error for invalid query format", async function () {
			const invalidQuery = {
				INVALID: "query",
			};

			const res = await request(server.getApp())
				.post("/query")
				.set("Content-Type", "application/json")
				.send(invalidQuery);

			expect(res.status).to.equal(StatusCodes.BAD_REQUEST);
			expect(res.body).to.have.property("error");
		});

		it("should return empty results for query with no matches", async function () {
			const datasetId = "emptyQueryTest";
			const buffer = Buffer.from(sectionsDataset, "base64");

			// Add a dataset
			await request(server.getApp())
				.put(`/dataset/${datasetId}/${InsightDatasetKind.Sections}`)
				.set("Content-Type", "application/zip")
				.send(buffer);

			// Query with impossible condition
			const query = {
				WHERE: {
					GT: {
						[`${datasetId}_avg`]: 1000,
					},
				},
				OPTIONS: {
					COLUMNS: [`${datasetId}_uuid`],
				},
			};

			const res = await request(server.getApp()).post("/query").set("Content-Type", "application/json").send(query);

			expect(res.status).to.equal(StatusCodes.OK);
			expect(res.body.result).to.be.an("array");
			expect(res.body.result).to.be.empty;
		});
	});
});
