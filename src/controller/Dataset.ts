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
	fullname: string;
	shortname: string;
	address: string;
	lat: number;
	lon: number;
	href: string;
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

	public async getRoomsById(id: string): Promise<Room[]> {
		await this.loadData();
		for (const dataset of this.datasets) {
			if (dataset.id === id) {
				return dataset.content;
			}
		}
		throw new InsightError(`Dataset with id '${id}' not found`);
	}
}

export class FileUnzipper {
	public static async unzipData(content: string): Promise<JSZip> {
		const unzipped = new JSZip();
		try {
			await unzipped.loadAsync(content, { base64: true });
		} catch (error) {
			throw new InsightError("content is not base64 encoded string");
		}
		return unzipped;
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
		};
	}
}

export class SectionsDataProcessor {
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
		const unzipped = await FileUnzipper.unzipData(content);
		const files = SectionsDataProcessor.extractCourseFiles(unzipped);
		const sections = await SectionsDataProcessor.processSectionFiles(files);
		return SectionsDataProcessor.validateSections(sections);
	}
}

export class BuildingRoomFileParser {
	public static async ParseData(file: JSZipObject) {
		const text = await file.async("text");
		return parse5.parse(text);
	}
}

export class RoomsDataProcessor {
	private static getTables(doc: any): any[] {
		const tables: any[] = [];
		if (doc.nodeName === "table") {
			tables.push(doc);
		}
		if (!doc.childNodes) {
			return tables;
		}
		for (let i = 0; i < doc.childNodes.length; i++) {
			const children = RoomsDataProcessor.getTables(doc.childNodes[i]);
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

	private static getAttr(node: any, name: string) {
		if (!node.attrs) {
			return null;
		}
		for (let i = 0; i < node.attrs.length; i++) {
			const attr = node.attrs[i];
			if (attr.name === name) {
				return attr.value;
			}
		}
		return null;
	}

	private static hasViewsField(td: any): boolean {
		const attr = RoomsDataProcessor.getAttr(td, "class");
		if (!attr) {
			return false;
		}
		const classValue = attr.split(/\s+/);
		return classValue.includes("views-field");
	}

	private static findCorrectTable(doc: any): any[] {
		const tables = RoomsDataProcessor.getTables(doc);
		for (const table of tables) {
			const tbodies = RoomsDataProcessor.getChildren(table, "tbody");

			for (const tbody of tbodies) {
				const trs = RoomsDataProcessor.getChildren(tbody, "tr");

				for (const tr of trs) {
					const tds = RoomsDataProcessor.getChildren(tr, "td");

					for (const td of tds) {
						if (RoomsDataProcessor.hasViewsField(td)) {
							return trs;
						}
					}
				}
			}
		}
		return [];
	}

	private static findAttr(node: any, value: string): boolean {
		if (!node.attrs) {
			return false;
		}
		for (let i = 0; i < node.attrs.length; i++) {
			const attr = node.attrs[i];
			if (attr.value === value) {
				return true;
			}
		}
		return false;
	}

	private static getAnchorText(cell: any, title: string) {
		const as = RoomsDataProcessor.getChildren(cell, "a");
		for (const a of as) {
			if (RoomsDataProcessor.findAttr(a, title)) {
				for (let i = 0; i < a.childNodes.length; i++) {
					const child = a.childNodes[i];
					if (child.nodeName === "#text") {
						return child.value.trim();
					}
				}
			}
		}
		return null;
	}

	private static getText(cell: any) {
		for (let i = 0; i < cell.childNodes.length; i++) {
			const child = cell.childNodes[i];
			if (child.nodeName === "#text") {
				return child.value.trim();
			}
		}
		return null;
	}

	private static getHref(cell: any) {
		const as = RoomsDataProcessor.getChildren(cell, "a");
		for (const a of as) {
			const href = RoomsDataProcessor.getAttr(a, "href");
			if (href) {
				return href;
			}
		}
		return null;
	}

	private static async processBuildingFiles(files: JSZip): Promise<Building[]> {
		const buildings: Building[] = [];
		const index = files.file("index.htm");
		if (!index) {
			throw new InsightError("Index file not found");
		}
		const doc = await BuildingRoomFileParser.ParseData(index);
		const rows = RoomsDataProcessor.findCorrectTable(doc);
		if (rows.length === 0) {
			throw new InsightError("No building table found.");
		}
		for (const r of rows) {
			let fullname;
			let shortname;
			let address;
			let href;
			const cells = RoomsDataProcessor.getChildren(r, "td");
			for (const cell of cells) {
				if (RoomsDataProcessor.findAttr(cell, "views-field views-field-title")) {
					fullname = RoomsDataProcessor.getAnchorText(cell, "Building Details and Map");
				}
				if (RoomsDataProcessor.findAttr(cell, "views-field views-field-field-building-code")) {
					shortname = RoomsDataProcessor.getText(cell);
				}
				if (RoomsDataProcessor.findAttr(cell, "views-field views-field-field-building-address")) {
					address = RoomsDataProcessor.getText(cell);
				}
				if (RoomsDataProcessor.findAttr(cell, "views-field views-field-nothing")) {
					href = RoomsDataProcessor.getHref(cell);
				}
			}
			if (!fullname || !shortname || !address || !href) {
				continue;
			}
			const geoResponse: GeoResponse = await Geo.getGeolocation(address);
			buildings.push({
				fullname: String(fullname),
				shortname: String(shortname),
				address: String(address),
				lat: Number(geoResponse.lat),
				lon: Number(geoResponse.lon),
				href: String(href),
			});
		}
		if (buildings.length === 0) {
			throw new InsightError("Invalid dataset: no buildings found");
		}
		return buildings;
	}

	private static async processRoomFiles(buildings: Building[], files: JSZip): Promise<Room[]> {
		const rooms: Room[] = [];
		try {
			for (const building of buildings) {
				const file = files.file(building.href.replace(/^\.\//, ""));
				if (!file) {
					continue;
				}
				const doc = await BuildingRoomFileParser.ParseData(file);
				const rows = RoomsDataProcessor.findCorrectTable(doc);
				if (rows.length === 0) {
					continue;
				}
				for (const r of rows) {
					let number;
					let seats;
					let type;
					let furniture;
					let href;
					const cells = RoomsDataProcessor.getChildren(r, "td");
					for (const cell of cells) {
						if (RoomsDataProcessor.findAttr(cell, "views-field views-field-field-room-number")) {
							number = RoomsDataProcessor.getAnchorText(cell, "Room Details");
						}
						if (RoomsDataProcessor.findAttr(cell, "views-field views-field-field-room-capacity")) {
							seats = RoomsDataProcessor.getText(cell);
						}
						if (RoomsDataProcessor.findAttr(cell, "views-field views-field-field-room-furniture")) {
							furniture = RoomsDataProcessor.getText(cell);
						}
						if (RoomsDataProcessor.findAttr(cell, "views-field views-field-field-room-type")) {
							type = RoomsDataProcessor.getText(cell);
						}
						if (RoomsDataProcessor.findAttr(cell, "views-field views-field-nothing")) {
							href = RoomsDataProcessor.getHref(cell);
						}
					}
					if (!number || !seats || !furniture || !type || !href) {
						continue;
					}
					rooms.push({
						fullname: building.fullname,
						shortname: building.shortname,
						number: String(number),
						name: building.shortname + "_" + String(number),
						address: building.address,
						lat: building.lat,
						lon: building.lon,
						seats: Number(seats),
						type: String(type),
						furniture: String(furniture),
						href: String(href),
					});
				}
			}
		} catch (error) {
			throw new InsightError(error + " Error processing room files");
		}
		if (rooms.length === 0) {
			throw new InsightError("Invalid dataset: no rooms available");
		}
		return rooms;
	}

	public static async getRooms(content: string): Promise<Room[]> {
		const unzipped = await FileUnzipper.unzipData(content);
		const buildings = await RoomsDataProcessor.processBuildingFiles(unzipped);
		return await RoomsDataProcessor.processRoomFiles(buildings, unzipped);
	}
}
