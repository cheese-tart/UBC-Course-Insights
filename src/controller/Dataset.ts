import { InsightDatasetKind, InsightDataset } from "./IInsightFacade";

import fs from "fs-extra";

export interface Section {
	uuid: string;
	id: string;
	title: string;
	instructor: string;
	dept: string;
	year: number;
	avg: number;
	pass: number;
	fail: number;
	audit: number;
}

export interface Room {
	// i have a fat boner
}

export interface Dataset extends InsightDataset {
	content: Section[] | Room[];
}

const directory: string = "data";
const file: string = directory + "/datasets.json";

export class DatasetPersistence {
	private datasets: Dataset[];

	constructor() {
		this.datasets = [];
	}

	public async addDataset(dataset: Dataset): Promise<void> {
		this.datasets.push(dataset);
	}

	public async getDatasets(): Promise<Dataset[]> {
		return this.datasets;
	}

	public async setDatasets(datasets: Dataset[]): Promise<void> {
		this.datasets = datasets;
	}

	public async ensurePersistence(): Promise<void> {
		try {
			await fs.ensureDir(directory);
			await fs.ensureFile(file);
		} catch (error) {
			console.error('penis');
		}
	}

	public async loadData(): Promise<void> {
		try {
			const data = await fs.readJson(file);
			this.datasets = Array.isArray(data) ? data : [];
		} catch (error) {
			console.error('penis');
		}
	}

	public async saveData(): Promise<void> {
		try {
			await fs.writeJson(file, this.datasets);
		} catch {
			console.error('penis');
		}
	}
}

export class DataProcessor {

}
