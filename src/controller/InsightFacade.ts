import {
	IInsightFacade,
	InsightDataset,
	InsightDatasetKind,
	InsightError,
	InsightResult,
	NotFoundError,
	ResultTooLargeError,
} from "./IInsightFacade";

import { SectionsDataProcessor, RoomsDataProcessor, Dataset, DatasetPersistence, Section, Room } from "./Dataset";
import { QueryEngine } from "./Query";

/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
export default class InsightFacade implements IInsightFacade {
	private readonly data: DatasetPersistence;

	constructor() {
		this.data = new DatasetPersistence();
	}

	// returns true if invalid id
	private static checkId(id: string): boolean {
		return !id || id.trim() === "" || id.includes("_");
	}

	// returns true if content is invalid
	private static checkContent(s: string): boolean {
		if (!s || s.trim() === "") {
			return true;
		}
		return s.length % 4 !== 0;
	}

	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		await this.data.loadData();

		if (InsightFacade.checkId(id)) {
			throw new InsightError("Invalid ID");
		}
		if (InsightFacade.checkContent(content)) {
			throw new InsightError("Invalid content");
		}
		if (this.data.getDatasets().some((dataset) => dataset.id === id)) {
			throw new InsightError("Duplicate ID");
		}

		if (kind === InsightDatasetKind.Sections) {
			const sections: Section[] = await SectionsDataProcessor.getSections(content);
			const dataset: Dataset = { id: id, kind: kind, numRows: sections.length, content: sections };
			this.data.addDataset(dataset);
		} else if (kind === InsightDatasetKind.Rooms) {
			const rooms: Room[] = await RoomsDataProcessor.getRooms(content);
			const dataset: Dataset = { id: id, kind: kind, numRows: rooms.length, content: rooms };
			this.data.addDataset(dataset);
		}
		await this.data.saveData();

		return this.data.getDatasets().map((d) => d.id);
	}

	public async removeDataset(id: string): Promise<string> {
		await this.data.loadData();

		if (InsightFacade.checkId(id)) {
			throw new InsightError("Invalid ID");
		}

		const datasets = this.data.getDatasets();
		const filtered = datasets.filter((dataset) => dataset.id !== id);
		
		if (filtered.length === datasets.length) {
			throw new NotFoundError();
		}

		this.data.setDatasets(filtered);
		await this.data.saveData();
		return id;
	}

	public async performQuery(query: unknown): Promise<InsightResult[]> {
		try {
			const ast = QueryEngine.parseQuery(query);
			QueryEngine.validateSemantics(ast);
			return await QueryEngine.executeQuery(ast, this.data);
		} catch (err) {
			if (err instanceof InsightError) throw err;
			if (err instanceof ResultTooLargeError) throw err;
			throw new Error("Unexpected error");
		}
	}

	public async listDatasets(): Promise<InsightDataset[]> {
		await this.data.loadData();
		return this.data.getDatasets().map((dataset) => ({
			id: dataset.id,
			kind: dataset.kind,
			numRows: dataset.numRows,
		}));
	}
}
