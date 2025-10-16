import {
	IInsightFacade,
	InsightDataset,
	InsightDatasetKind,
	InsightResult,
	InsightError,
	NotFoundError
} from "./IInsightFacade";
import { Section, Dataset, DatasetPersistence, DataProcessor } from "./Dataset";

/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
export default class InsightFacade implements IInsightFacade {
	private data: DatasetPersistence;

	constructor() {
		this.data = new DatasetPersistence();
	}

	// returns true if invalid id
	private static checkId(id: string): boolean {
		return !id || id.trim() === '' || id.includes('_');
	}

	// returns true if content is invalid
	private static checkContent(s: string): boolean {
		if (!s || s.trim() === '') {
			return true;
		}
		return s.length % 4 !== 0;

	}

	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		await this.data.loadData();

		if (InsightFacade.checkId(id)) {
			throw new InsightError('Invalid ID');
		}
		if (InsightFacade.checkContent(content)) {
			throw new InsightError('Invalid content');
		}
		for (const dataset of this.data.getDatasets()) {
			if (dataset.id === id) {
				throw new InsightError('Duplicate ID');
			}
		}

		const sections: Section[] = await DataProcessor.getSections(content);
		const dataset: Dataset = { id: id, kind: kind, numRows: sections.length, content: sections }
		this.data.addDataset(dataset);
		await this.data.saveData();

		const ids: string[] = [];
		for (const d of this.data.getDatasets()) {
			ids.push(d.id);
		}
		return ids;
	}

	public async removeDataset(id: string): Promise<string> {
		await this.data.loadData();

		if (InsightFacade.checkId(id)) {
			throw new InsightError('Invalid ID');
		}

		let found = false;
		for (const dataset of this.data.getDatasets()) {
			if (dataset.id === id) {
				found = true;
				break;
			}
		}
		if (!found) {
			throw new NotFoundError();
		}

		const filtered: Dataset[] = [];
		for (const dataset of this.data.getDatasets()) {
			if (dataset.id !== id) {
				filtered.push(dataset);
			}
		}

		this.data.setDatasets(filtered);
		await this.data.saveData();
		return id;
	}

	public async performQuery(query: unknown): Promise<InsightResult[]> {
		// TODO: tell lucas to go FUCK HIMSELF
		throw new Error(`InsightFacadeImpl::performQuery() is unimplemented! - query=${query};`);
	}

	public async listDatasets(): Promise<InsightDataset[]> {
		await this.data.loadData();
		const list: InsightDataset[] = [];

		for (const dataset of this.data.getDatasets()) {
			list.push({
				id: dataset.id,
				kind: dataset.kind,
				numRows: dataset.numRows
			})
			// console.log(dataset);
		}
		return list;
	}
}
