import {InsightError, InsightResult, ResultTooLargeError} from "./IInsightFacade";
import {DatasetPersistence, Section} from "./Dataset";

export const NUMERIC_FIELDS = new Set(["avg", "pass", "fail", "audit", "year"]);
export const STRING_FIELDS = new Set(["dept", "id", "instructor", "title", "uuid"]);

export type QueryAST = {
	type: "QUERY";
	where: FilterAST | { type: "EMPTY" };
	columns: string[];
	order?: string;
	transformations?: string;
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

		QueryEngine.assert(Array.isArray(optionsRaw.COLUMNS) && optionsRaw.COLUMNS.length > 0, "COLUMNS must be a non-empty array");
		const columns = optionsRaw.COLUMNS as unknown[];
		columns.forEach((k) => QueryEngine.assert(typeof k === "string", "COLUMNS entries must be strings"));

		let order: string | undefined;
		if (optionsRaw.ORDER !== undefined) {
			QueryEngine.assert(typeof optionsRaw.ORDER === "string", "ORDER must be a string key");
			order = optionsRaw.ORDER as string;
		}

		return {
			type: "QUERY",
			where: where ?? {type: "EMPTY"},
			columns: columns as string[],
			order,
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
				QueryEngine.assert(QueryEngine.isObject(body) && Object.keys(body).length === 1, `${tag} must be an object with one key`);
				const key = Object.keys(body)[0];
				const value = (body as any)[key];
				QueryEngine.assert(typeof value === "number", `${tag} comparator value must be a number`);
				return { type: tag, key, value } as FilterAST;
			}
			case "IS": {
				QueryEngine.assert(QueryEngine.isObject(body) && Object.keys(body).length === 1, "IS must be an object with one key");
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
		const collectKey = (k: string) => datasetIds.add(QueryEngine.getDatasetAndField(k).dataset);

		ast.columns.forEach(collectKey);
		if (ast.order) collectKey(ast.order);
		QueryEngine.walkFilter(ast.where, (node) => {
			if (node.type === "LT" || node.type === "GT" || node.type === "EQ" || node.type === "IS") {
				collectKey(node.key);
			}
		});
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

		if (ast.order) {
			QueryEngine.assert(ast.columns.includes(ast.order), "ORDER key must appear in COLUMNS");
		}

		ast.columns.forEach((key) => {
			const { field } = QueryEngine.getDatasetAndField(key);
			QueryEngine.assert(NUMERIC_FIELDS.has(field) || STRING_FIELDS.has(field), `Invalid column field '${field}'`);
		});
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
		const datasetId = QueryEngine.getDatasetAndField(ast.columns[0]).dataset;

		const rows = await datasets.getSectionsById(datasetId);

		const filtered = rows.filter((r: any) => QueryEngine.evalFilter(ast.where, r, datasetId));

		const projected: InsightResult[] = filtered.map((r: { [x: string]: any }) => {
			const out: InsightResult = {};
			for (const key of ast.columns) {
				const { field } = QueryEngine.getDatasetAndField(key);
				out[key] = r[field as keyof Section] as any;
			}
			return out;
		});

		if (ast.order) {
			const orderKey = ast.order;
			projected.sort((a, b) => compareValues(a[orderKey], b[orderKey]));
		}

		function compareValues(x: any, y: any): number {
			if (typeof x === "number" && typeof y === "number") return x - y;
			return String(x).localeCompare(String(y));
		}

		if (projected.length > 5000) throw new ResultTooLargeError();

		return projected;
	}

	private static evalFilter(node: FilterAST | { type: "EMPTY" }, row: Section, datasetId: string): boolean {
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

	private static compareNumeric(node: Extract<FilterAST, { type: "LT" | "GT" | "EQ" }>, row: Section): boolean {
		const { field } = QueryEngine.getDatasetAndField(node.key);
		const actual = (row as any)[field];
		if (typeof actual !== "number") throw new InsightError(`Field ${field} is not numeric`);
		if (node.type === "LT") return actual < node.value;
		if (node.type === "GT") return actual > node.value;
		return actual === node.value;
	}

	private static compareString(node: Extract<FilterAST, { type: "IS" }>, row: Section): boolean {
		const { field } = QueryEngine.getDatasetAndField(node.key);
		const actual = (row as any)[field];
		if (typeof actual !== "string") throw new InsightError(`Field ${field} is not string`);
		return QueryEngine.wildcardMatch(actual, node.pattern);
	}
}
