import { InsightError, InsightResult, ResultTooLargeError } from "./IInsightFacade";
import { DatasetPersistence, Section, Room } from "./Dataset";
import Decimal from "decimal.js";

export const NUMERIC_FIELDS = new Set(["avg", "pass", "fail", "audit", "year", "lat", "lon", "seats"]);
export const STRING_FIELDS = new Set([
	"dept",
	"id",
	"instructor",
	"title",
	"uuid",
	"fullname",
	"shortname",
	"number",
	"name",
	"address",
	"type",
	"furniture",
	"href",
]);

export type QueryAST = {
	type: "QUERY";
	where: FilterAST | { type: "EMPTY" };
	columns: string[];
	order?: string | { dir: "UP" | "DOWN"; keys: string[] };
	transformations?: {
		group: string[];
		apply: ApplyRule[];
	};
};

export type ApplyRule = {
	key: string;
	token: "MAX" | "MIN" | "AVG" | "COUNT" | "SUM";
	field: string;
};

export type FilterAST =
	| { type: "AND"; children: FilterAST[] }
	| { type: "OR"; children: FilterAST[] }
	| { type: "NOT"; child: FilterAST }
	| { type: "LT" | "GT" | "EQ"; key: string; value: number }
	| { type: "IS"; key: string; pattern: string };

export class QueryEngine {
	private static isObject(x: unknown): x is Record<string, unknown> {
		return typeof x === "object" && x !== null && !Array.isArray(x);
	}

	private static assert(cond: unknown, msg: string): asserts cond {
		if (!cond) throw new InsightError(msg);
	}

	private static getDatasetAndField(key: string): { dataset: string; field: string } {
		const idx = key.indexOf("_");
		if (idx <= 0) throw new InsightError(`Invalid key '${key}'. Expected <id>_<field>.`);
		const dataset = key.slice(0, idx);
		const field = key.slice(idx + 1);
		return { dataset, field };
	}

	private static wildcardMatch(value: string, pattern: string): boolean {
		if (pattern === "*" || pattern === "**") {
			return true;
		}
		const starts = pattern.startsWith("*");
		const ends = pattern.endsWith("*");
		const core = pattern.substring(starts ? 1 : 0, ends ? pattern.length - 1 : pattern.length);
		if (pattern.includes("*", 1) && !ends) {
			throw new InsightError("Invalid wildcard placement in IS comparison");
		}
		if (starts && ends) return value.includes(core);
		if (starts) return value.endsWith(core);
		if (ends) return value.startsWith(core);
		return value === core;
	}

	public static parseQuery(input: unknown): QueryAST {
		QueryEngine.assert(QueryEngine.isObject(input), "Query must be an object");

		QueryEngine.assert("WHERE" in input, "Missing WHERE block");
		const whereRaw = (input as any).WHERE;
		const where = QueryEngine.parseWhere(whereRaw);

		QueryEngine.assert("OPTIONS" in input && QueryEngine.isObject((input as any).OPTIONS), "Missing OPTIONS block");
		const optionsRaw = (input as any).OPTIONS as Record<string, unknown>;

		QueryEngine.assert(
			Array.isArray(optionsRaw.COLUMNS) && optionsRaw.COLUMNS.length > 0,
			"COLUMNS must be a non-empty array"
		);
		const columns = optionsRaw.COLUMNS as unknown[];
		columns.forEach((k) => QueryEngine.assert(typeof k === "string", "COLUMNS entries must be strings"));

		let order: string | { dir: "UP" | "DOWN"; keys: string[] } | undefined;
		if (optionsRaw.ORDER !== undefined) {
			if (typeof optionsRaw.ORDER === "string") {
				order = optionsRaw.ORDER;
			} else if (QueryEngine.isObject(optionsRaw.ORDER)) {
				const orderObj = optionsRaw.ORDER as Record<string, unknown>;
				QueryEngine.assert("dir" in orderObj && "keys" in orderObj, "ORDER object must have 'dir' and 'keys'");
				QueryEngine.assert(orderObj.dir === "UP" || orderObj.dir === "DOWN", "ORDER dir must be 'UP' or 'DOWN'");
				QueryEngine.assert(
					Array.isArray(orderObj.keys) && orderObj.keys.length > 0,
					"ORDER keys must be a non-empty array"
				);
				orderObj.keys.forEach((k: unknown) =>
					QueryEngine.assert(typeof k === "string", "ORDER keys entries must be strings")
				);
				order = {
					dir: orderObj.dir as "UP" | "DOWN",
					keys: orderObj.keys as string[],
				};
			} else {
				throw new InsightError("ORDER must be a string or an object");
			}
		}

		let transformations: { group: string[]; apply: ApplyRule[] } | undefined;
		if ("TRANSFORMATIONS" in input) {
			QueryEngine.assert(QueryEngine.isObject((input as any).TRANSFORMATIONS), "TRANSFORMATIONS must be an object");
			const transRaw = (input as any).TRANSFORMATIONS as Record<string, unknown>;

			QueryEngine.assert("GROUP" in transRaw && Array.isArray(transRaw.GROUP), "TRANSFORMATIONS must have GROUP array");
			const groupRaw = transRaw.GROUP as unknown[];
			QueryEngine.assert(groupRaw.length > 0, "GROUP must be a non-empty array");
			groupRaw.forEach((k) => QueryEngine.assert(typeof k === "string", "GROUP entries must be strings"));

			QueryEngine.assert("APPLY" in transRaw && Array.isArray(transRaw.APPLY), "TRANSFORMATIONS must have APPLY array");
			const applyRaw = transRaw.APPLY as unknown[];
			applyRaw.forEach((rule) => QueryEngine.assert(QueryEngine.isObject(rule), "APPLY entries must be objects"));

			const applyRules: ApplyRule[] = [];
			for (const rule of applyRaw) {
				const ruleObj = rule as Record<string, unknown>;
				QueryEngine.assert(Object.keys(ruleObj).length === 1, "APPLY rule must have exactly one key");
				const applyKey = Object.keys(ruleObj)[0];
				QueryEngine.assert(QueryEngine.isObject(ruleObj[applyKey]), "APPLY rule value must be an object");
				const applyValue = ruleObj[applyKey] as Record<string, unknown>;
				QueryEngine.assert(Object.keys(applyValue).length === 1, "APPLY rule value must have exactly one key");
				const token = Object.keys(applyValue)[0];
				QueryEngine.assert(["MAX", "MIN", "AVG", "COUNT", "SUM"].includes(token), `Invalid APPLY token '${token}'`);
				const field = applyValue[token];
				QueryEngine.assert(typeof field === "string", "APPLY field must be a string");
				applyRules.push({
					key: applyKey,
					token: token as "MAX" | "MIN" | "AVG" | "COUNT" | "SUM",
					field: field as string,
				});
			}

			transformations = {
				group: groupRaw as string[],
				apply: applyRules,
			};
		}

		return {
			type: "QUERY",
			where: where ?? { type: "EMPTY" },
			columns: columns as string[],
			order,
			transformations,
		};
	}

	private static parseWhere(raw: unknown): FilterAST | undefined {
		if (!QueryEngine.isObject(raw)) {
			if (raw && typeof raw === "object") throw new InsightError("WHERE must be an object");
			return undefined;
		}
		const keys = Object.keys(raw);
		if (keys.length === 0) return undefined;
		QueryEngine.assert(keys.length === 1, "WHERE must contain exactly one filter node");

		const tag = keys[0];
		const body = (raw as any)[tag];

		switch (tag) {
			case "AND":
			case "OR": {
				QueryEngine.assert(Array.isArray(body) && body.length > 0, `${tag} must be a non-empty array`);
				const children = (body as unknown[]).map(QueryEngine.parseWhereNode);
				return { type: tag, children } as FilterAST;
			}
			case "NOT": {
				QueryEngine.assert(QueryEngine.isObject(body), "NOT must wrap a single filter object");
				const child = QueryEngine.parseWhere(body);
				QueryEngine.assert(child !== undefined, "NOT cannot be empty");
				return { type: "NOT", child: child as FilterAST };
			}
			case "LT":
			case "GT":
			case "EQ": {
				QueryEngine.assert(
					QueryEngine.isObject(body) && Object.keys(body).length === 1,
					`${tag} must be an object with one key`
				);
				const key = Object.keys(body)[0];
				const value = (body as any)[key];
				QueryEngine.assert(typeof value === "number", `${tag} comparator value must be a number`);
				return { type: tag, key, value } as FilterAST;
			}
			case "IS": {
				QueryEngine.assert(
					QueryEngine.isObject(body) && Object.keys(body).length === 1,
					"IS must be an object with one key"
				);
				const key = Object.keys(body)[0];
				const value = (body as any)[key];
				QueryEngine.assert(typeof value === "string", "IS comparison value must be a string");
				return { type: "IS", key, pattern: value };
			}
			default:
				throw new InsightError(`Unknown WHERE operator '${tag}'`);
		}
	}

	private static parseWhereNode(node: unknown): FilterAST {
		QueryEngine.assert(QueryEngine.isObject(node), "Filter node must be an object");
		return QueryEngine.parseWhere(node)!;
	}

	public static validateSemantics(ast: QueryAST) {
		const datasetIds = new Set<string>();

		const collectKey = (k: string) => {
			if (k.includes("_")) {
				datasetIds.add(QueryEngine.getDatasetAndField(k).dataset);
			}
		};

		ast.columns.forEach((key) => {
			if (key.includes("_")) {
				collectKey(key);
			}
		});

		if (ast.order) {
			if (typeof ast.order === "string") {
				collectKey(ast.order);
			} else {
				ast.order.keys.forEach(collectKey);
			}
		}
		QueryEngine.walkFilter(ast.where, (node) => {
			if (node.type === "LT" || node.type === "GT" || node.type === "EQ" || node.type === "IS") {
				collectKey(node.key);
			}
		});

		if (ast.transformations) {
			ast.transformations.group.forEach(collectKey);
			ast.transformations.apply.forEach((rule) => collectKey(rule.field));
		}

		QueryEngine.assert(datasetIds.size === 1, "Query must reference exactly one dataset id");

		QueryEngine.walkFilter(ast.where, (node) => {
			if (node.type === "LT" || node.type === "GT" || node.type === "EQ") {
				const { field } = QueryEngine.getDatasetAndField(node.key);
				QueryEngine.assert(NUMERIC_FIELDS.has(field), `${node.type} must use a numeric field`);
			}
			if (node.type === "IS") {
				const { field } = QueryEngine.getDatasetAndField(node.key);
				QueryEngine.assert(STRING_FIELDS.has(field), "IS must use a string field");
			}
		});

		if (ast.transformations) {
			ast.transformations.group.forEach((key) => {
				const { field } = QueryEngine.getDatasetAndField(key);
				QueryEngine.assert(NUMERIC_FIELDS.has(field) || STRING_FIELDS.has(field), `Invalid GROUP field '${field}'`);
			});

			const applyKeys = new Set<string>();
			ast.transformations.apply.forEach((rule) => {
				QueryEngine.assert(!applyKeys.has(rule.key), `Duplicate apply key '${rule.key}'`);
				applyKeys.add(rule.key);

				const { field } = QueryEngine.getDatasetAndField(rule.field);
				if (rule.token === "MAX" || rule.token === "MIN" || rule.token === "AVG" || rule.token === "SUM") {
					QueryEngine.assert(NUMERIC_FIELDS.has(field), `${rule.token} must use a numeric field`);
				}
			});

			const groupSet = new Set(ast.transformations.group);
			const applyKeySet = new Set(ast.transformations.apply.map((r) => r.key));
			ast.columns.forEach((key) => {
				QueryEngine.assert(
					groupSet.has(key) || applyKeySet.has(key),
					`COLUMNS key '${key}' must be in GROUP or be an apply key`
				);
			});
		} else {
			ast.columns.forEach((key) => {
				QueryEngine.assert(
					key.includes("_"),
					`Column '${key}' must be a dataset key when TRANSFORMATIONS are not present`
				);
				const { field } = QueryEngine.getDatasetAndField(key);
				QueryEngine.assert(NUMERIC_FIELDS.has(field) || STRING_FIELDS.has(field), `Invalid column field '${field}'`);
			});
		}

		if (ast.order) {
			if (typeof ast.order === "string") {
				QueryEngine.assert(ast.columns.includes(ast.order), "ORDER key must appear in COLUMNS");
				if (ast.order.includes("_")) {
					const { field } = QueryEngine.getDatasetAndField(ast.order);
					QueryEngine.assert(NUMERIC_FIELDS.has(field) || STRING_FIELDS.has(field), `Invalid ORDER field '${field}'`);
				}
			} else {
				ast.order.keys.forEach((key) => {
					QueryEngine.assert(ast.columns.includes(key), `ORDER key '${key}' must appear in COLUMNS`);
					if (key.includes("_")) {
						const { field } = QueryEngine.getDatasetAndField(key);
						QueryEngine.assert(NUMERIC_FIELDS.has(field) || STRING_FIELDS.has(field), `Invalid ORDER field '${field}'`);
					}
				});
			}
		}
	}

	private static walkFilter(node: FilterAST | { type: "EMPTY" }, f: (n: FilterAST) => void) {
		if (node.type === "EMPTY") return;
		switch (node.type) {
			case "AND":
			case "OR":
				node.children.forEach((c) => QueryEngine.walkFilter(c, f));
				break;
			case "NOT":
				QueryEngine.walkFilter(node.child, f);
				break;
			default:
				f(node);
		}
	}

	public static async executeQuery(ast: QueryAST, datasets: DatasetPersistence): Promise<InsightResult[]> {
		let datasetId: string | null = null;

		for (const key of ast.columns) {
			if (key.includes("_")) {
				datasetId = QueryEngine.getDatasetAndField(key).dataset;
				break;
			}
		}

		if (!datasetId && ast.transformations) {
			for (const key of ast.transformations.group) {
				if (key.includes("_")) {
					datasetId = QueryEngine.getDatasetAndField(key).dataset;
					break;
				}
			}
		}

		if (!datasetId) {
			QueryEngine.walkFilter(ast.where, (node) => {
				if ((node.type === "LT" || node.type === "GT" || node.type === "EQ" || node.type === "IS") && !datasetId) {
					if (node.key.includes("_")) {
						datasetId = QueryEngine.getDatasetAndField(node.key).dataset;
					}
				}
			});
		}

		if (!datasetId) {
			throw new InsightError("Could not determine dataset ID from query");
		}

		const finalDatasetId: string = datasetId;

		let rows: (Section | Room)[];
		try {
			rows = await datasets.getSectionsById(finalDatasetId);
		} catch {
			try {
				rows = await datasets.getRoomsById(finalDatasetId);
			} catch {
				throw new InsightError(`Dataset with id '${finalDatasetId}' not found`);
			}
		}

		const filtered = rows.filter((r: any) => QueryEngine.evalFilter(ast.where, r, finalDatasetId));

		let projected: InsightResult[];

		if (ast.transformations) {
			const transformations = ast.transformations;
			const groups = QueryEngine.groupRows(filtered, transformations.group);

			const groupedResults: InsightResult[] = [];
			groups.forEach((group) => {
				const result: InsightResult = {};

				for (const groupKeyField of transformations.group) {
					const { field } = QueryEngine.getDatasetAndField(groupKeyField);
					result[groupKeyField] = group[0][field as keyof (Section | Room)] as any;
				}

				for (const rule of transformations.apply) {
					result[rule.key] = QueryEngine.applyRule(group, rule);
				}

				groupedResults.push(result);
			});

			projected = groupedResults.map((r) => {
				const out: InsightResult = {};
				for (const key of ast.columns) {
					out[key] = r[key];
				}
				return out;
			});
		} else {
			projected = filtered.map((r: { [x: string]: any }) => {
				const out: InsightResult = {};
				for (const key of ast.columns) {
					const { field } = QueryEngine.getDatasetAndField(key);
					out[key] = r[field as keyof (Section | Room)] as any;
				}
				return out;
			});
		}

		if (ast.order) {
			if (typeof ast.order === "string") {
				const orderKey = ast.order;
				projected.sort((a, b) => QueryEngine.compareValues(a[orderKey], b[orderKey], true));
			} else {
				const orderObj = ast.order;
				projected.sort((a, b) => {
					for (const key of orderObj.keys) {
						const cmp = QueryEngine.compareValues(a[key], b[key], orderObj.dir === "UP");
						if (cmp !== 0) return cmp;
					}
					return 0;
				});
			}
		}

		if (projected.length > 5000) throw new ResultTooLargeError();

		return projected;
	}

	private static groupRows(
		rows: (Section | Room)[],
		groupKeys: string[]
	): Map<string, (Section | Room)[]> {
		const groups = new Map<string, (Section | Room)[]>();

		for (const row of rows) {
			const groupKeyParts: string[] = [];
			for (const key of groupKeys) {
				const { field } = QueryEngine.getDatasetAndField(key);
				const value = row[field as keyof (Section | Room)];
				groupKeyParts.push(String(value));
			}
			const groupKey = groupKeyParts.join("|");

			if (!groups.has(groupKey)) {
				groups.set(groupKey, []);
			}
			groups.get(groupKey)!.push(row);
		}

		return groups;
	}

	private static applyRule(group: (Section | Room)[], rule: ApplyRule): number {
		const { field } = QueryEngine.getDatasetAndField(rule.field);

		if (rule.token === "COUNT") {
			const uniqueValues = new Set<any>();
			for (const row of group) {
				const value = row[field as keyof (Section | Room)];
				uniqueValues.add(value);
			}
			return uniqueValues.size;
		}

		const numericValues: number[] = [];
		for (const row of group) {
			const value = row[field as keyof (Section | Room)];
			numericValues.push(value);
		}

		switch (rule.token) {
			case "MAX":
				return Math.max(...numericValues);
			case "MIN":
				return Math.min(...numericValues);
			case "AVG": {
				let total = new Decimal(0);
				for (const v of numericValues) {
					total = total.add(new Decimal(v));
				}
				const avg = total.toNumber() / numericValues.length;
				return Number(avg.toFixed(2));
			}
			case "SUM": {
				let sum = 0;
				for (const v of numericValues) {
					sum += v;
				}
				return Number(sum.toFixed(2));
			}
		}
	}

	private static compareValues(x: any, y: any, ascending: boolean): number {
		let result: number;
		if (typeof x === "number" && typeof y === "number") {
			result = x - y;
		} else {
			result = String(x).localeCompare(String(y));
		}
		return ascending ? result : -result;
	}

	private static evalFilter(node: FilterAST | { type: "EMPTY" }, row: Section | Room, datasetId: string): boolean {
		if (node.type === "EMPTY") return true;
		switch (node.type) {
			case "AND":
				return node.children.every((c) => QueryEngine.evalFilter(c, row, datasetId));
			case "OR":
				return node.children.some((c) => QueryEngine.evalFilter(c, row, datasetId));
			case "NOT":
				return !QueryEngine.evalFilter(node.child, row, datasetId);
			case "LT":
				return QueryEngine.compareNumeric(node, row);
			case "GT":
				return QueryEngine.compareNumeric(node, row);
			case "EQ":
				return QueryEngine.compareNumeric(node, row);
			case "IS":
				return QueryEngine.compareString(node, row);
		}
	}

	private static compareNumeric(node: Extract<FilterAST, { type: "LT" | "GT" | "EQ" }>, row: Section | Room): boolean {
		const { field } = QueryEngine.getDatasetAndField(node.key);
		const actual = (row as any)[field];
		if (typeof actual !== "number") throw new InsightError(`Field ${field} is not numeric`);
		if (node.type === "LT") return actual < node.value;
		if (node.type === "GT") return actual > node.value;
		return actual === node.value;
	}

	private static compareString(node: Extract<FilterAST, { type: "IS" }>, row: Section | Room): boolean {
		const { field } = QueryEngine.getDatasetAndField(node.key);
		const actual = (row as any)[field];
		if (typeof actual !== "string") throw new InsightError(`Field ${field} is not string`);
		return QueryEngine.wildcardMatch(actual, node.pattern);
	}
}
