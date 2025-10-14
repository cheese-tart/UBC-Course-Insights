import { InsightDatasetKind, InsightDataset } from "./IInsightFacade";

import fs from "fs-extra";
import JSZip from "jszip";

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

	public addDataset(dataset: Dataset) {
		this.datasets.push(dataset);
	}

	public getDatasets(): Dataset[] {
		return this.datasets;
	}

	public setDatasets(datasets: Dataset[]) {
		this.datasets = datasets;
	}

	public async ensurePersistence(): Promise<void> {
		try {
			await fs.ensureDir(directory);
			await fs.ensureFile(file);
			const stats = await fs.stat(file);
			if (stats.size === 0) {
				await fs.writeJson(file, []);
			}
		} catch (error) {
			console.error('penis');
		}
	}

	public async loadData(): Promise<void> {
		try {
			this.datasets = await fs.readJson(file);
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
	private static async unzipData(content: string): Promise<JSZip> {
		const unzipped = new JSZip();
		await unzipped.loadAsync(content, { base64: true });
		return unzipped;
	}

	public static async extractCourseFiles(unzipped: JSZip) {

	}

	public static async getSections(content: string) {
		const unzipped = await DataProcessor.unzipData(content);
	}
}
