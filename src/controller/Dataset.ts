import { InsightDataset, InsightError } from "./IInsightFacade";
import { GeoResponse, Geo } from "./Geo";

import fs from "fs-extra";
import JSZip, { JSZipObject } from "jszip";
import parse5 from "parse5";

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

export interface Building {

}

export interface Room {
	fullname: string;
	shortname: string;
	number: string;
	name: string;
	address: string;
	lat: number;
	lon: number;
	seats: number;
	type: string;
	furniture: string;
	href: string;
}

export interface Dataset extends InsightDataset {
	content: any[];
}

const directory: string = "data";
const file: string = directory + "/datasets.json";

export class DatasetPersistence {
	private datasets: Dataset[];
	private dataLoaded: boolean;

	constructor() {
		this.datasets = [];
		this.dataLoaded = false;
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

	private static async ensurePersistence(): Promise<void> {
		try {
			await fs.ensureDir(directory);
			await fs.ensureFile(file);
			const stats = await fs.stat(file);
			if (stats.size === 0) {
				await fs.writeJson(file, []);
			}
		} catch (error) {
			console.error("penis");
		}
	}

	public async loadData(): Promise<void> {
		await DatasetPersistence.ensurePersistence();

		if (!this.dataLoaded) {
			try {
				this.datasets = await fs.readJson(file);
				this.dataLoaded = true;
			} catch (error) {
				console.error("penis");
			}
		}
	}

	public async saveData(): Promise<void> {
		try {
			await fs.writeJson(file, this.datasets);
		} catch {
			console.error("penis");
		}
	}

	public async getSectionsById(id: string): Promise<Section[]> {
		await this.loadData();
		for (const dataset of this.datasets) {
			if (dataset.id === id) {
				return dataset.content;
			}
		}
		throw new InsightError(`Dataset with id '${id}' not found`);
	}
}

export class SectionMapper {
	public static convertRaw(section: any): Section {
		return {
			uuid: String(section.id),
			id: String(section.Course),
			title: String(section.Title),
			instructor: String(section.Professor),
			dept: String(section.Subject),
			year: section.Section === "overall" ? 1900 : Number(section.Year),
			avg: Number(section.Avg),
			pass: Number(section.Pass),
			fail: Number(section.Fail),
			audit: Number(section.Audit),
		}
	}
}

export class DataProcessor {
	private static async unzipData(content: string): Promise<JSZip> {
		const unzipped = new JSZip();
		try {
			await unzipped.loadAsync(content, { base64: true });
		} catch (error) {
			throw new InsightError("content is not base64 encoded string");
		}
		return unzipped;
	}

	private static extractCourseFiles(unzipped: JSZip): JSZipObject[] {
		return Object.values(unzipped.files).filter((file) => !file.dir && file.name.startsWith("courses/"));
	}

	private static async processSectionFiles(files: JSZipObject[]): Promise<any[]> {
		const parsed_sections = [];
		for (const file of files) {
			const text = await file.async("text");

			let parsed: any;
			try {
				parsed = JSON.parse(text);
			} catch {
				continue;
			}
			if (!parsed || !Array.isArray(parsed.result)) {
				continue;
			}
			for (const res of parsed.result) {
				parsed_sections.push(res);
			}
		}

		return parsed_sections;
	}

	public static validateSections(parsed_sections: any[]): any[] {
		const sections: any[] = [];
		for (const section of parsed_sections) {
			sections.push(SectionMapper.convertRaw(section));
		}

		if (sections.length === 0) {
			throw new InsightError("Dataset has no valid sections");
		}
		return sections;
	}

	public static async getSections(content: string): Promise<any> {
		const unzipped = await DataProcessor.unzipData(content);
		const files = DataProcessor.extractCourseFiles(unzipped);
		const sections = await DataProcessor.processSectionFiles(files);
		return DataProcessor.validateSections(sections);
	}

	private static async extractRoomFiles(files: JSZip): Promise<string> {
		const index = files.file("index.htm");
		if (!index) {
			throw new InsightError("Kill yourself");
		}
		return index.async("text");
	}

	private static getTables(doc: any): any[] {
		const tables: any[] = [];
		if (doc.nodeName === "table") {
			tables.push(doc);
		}
		if (!doc.childNodes) {
			return tables;
		}
		for (let i = 0; i < doc.childNodes.length; i++) {
			const children = DataProcessor.getTables(doc.childNodes[i]);
			tables.push(...children);
		}
		return tables;
	}

	private static getChildren(node: any, tagName: string): any[] {
		const result: any[] = [];
		if (!node.childNodes) {
			return result;
		}
		for (let i = 0; i < node.childNodes.length; i++) {
			const child = node.childNodes[i];
			if (child.nodeName === tagName) {
				result.push(child);
			}
		}
		return result;
	}

	private static getAttr(td: any, name: string): any {
		if (!td.attrs) {
			return null;
		}
		for (let i = 0; i < td.attrs.length; i++) {
			const attr = td.attrs[i];
			if (attr.name === name) {
				return attr.value;
			}
		}
		return null;
	}

	private static hasViewsField(td: any): boolean {
		const attr = DataProcessor.getAttr(td, "class");
		if (!attr) {
			return false;
		}
		const classes = attr.split(/\s+/);
		return classes.includes("views-field");
	}

	private static findBuildingTable(doc: any): any {
		const tables = DataProcessor.getTables(doc);
		for (let i = 0; i < tables.length; i++) {
			const table = tables[i];
			const tbodies = DataProcessor.getChildren(table, "tbody");

			for (let j = 0; i < tbodies.length; i++) {
				const tbody = tbodies[j];
				const trs = DataProcessor.getChildren(tbody, "tr");

				for (let k = 0; k < trs.length; k++) {
					const tr = trs[k];
					const tds = DataProcessor.getChildren(tr, "td");

					for (let m = 0; m < tds.length; m++) {
						const td = tds[m];
						if (DataProcessor.hasViewsField(td)) {
							return trs;
						}
					}
				}
			}
		}
		throw new InsightError("Fuck you");
	}

	private static processBuildingFiles(text: string) {
		try {
			const doc = parse5.parse(text);
			const rows = DataProcessor.findBuildingTable(doc);
			for (const r in rows) {

			}
		} catch (error) {
			throw new InsightError("Dumb bitch");
		}
	}

	public static async getRooms(content: string) {
		const unzipped = await DataProcessor.unzipData(content);
		const text = await DataProcessor.extractRoomFiles(unzipped);
	}
}
