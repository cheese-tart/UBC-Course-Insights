import {
	IInsightFacade,
	InsightDataset,
	InsightDatasetKind,
	InsightResult,
	InsightError,
	NotFoundError
} from "./IInsightFacade";
import { Dataset, DatasetPersistence, DataProcessor } from "./Dataset";

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

	async init(): Promise<void> {
		await this.data.ensurePersistence();
		await this.data.loadData();
	}

	private static checkId(id: string): boolean {
		return !id || id.trim() === '' || id.includes('_');
	}

	private static checkContent(content: string): boolean {
		if (!content || content.trim() === '') {
			return false;
		}
		if (content.length % 4 !== 0) {
			return false;
		}
		// Taken from https://stackoverflow.com/questions/475074/regex-to-parse-or-validate-base64-data
		// Used regex found from link above
		const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
		return base64Regex.test(content);
	}

	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		if (InsightFacade.checkId(id)) {
			throw new InsightError('Invalid ID');
		}
		if (InsightFacade.checkContent(content)) {
			throw new InsightError('Invalid content');
		}
		const datasets: Dataset[] = this.data.getDatasets();
		for (const dataset of datasets) {
			if (dataset.id === id) {
				throw new InsightError('Duplicate ID');
			}
		}

		const sections = DataProcessor.getSections(content);

	}

	public async removeDataset(id: string): Promise<string> {
		if (InsightFacade.checkId(id)) {
			throw new InsightError('Invalid ID');
		}
		const datasets: Dataset[] = this.data.getDatasets();

		let found = false;
		for (const dataset of datasets) {
			if (dataset.id === id) {
				found = true;
				break;
			}
		}
		if (!found) {
			throw new NotFoundError();
		}

		const filtered: Dataset[] = [];
		for (const dataset of datasets) {
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
		const list: InsightDataset[] = [];
		const datasets: Dataset[] = this.data.getDatasets();

		for (const dataset of datasets) {
			list.push({
				id: dataset.id,
				kind: dataset.kind,
				numRows: dataset.numRows
			})
		}
		return list;
	}
}
