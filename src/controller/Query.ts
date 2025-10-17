import { InsightResult, InsightError, ResultTooLargeError } from "./IInsightFacade";
import { Dataset, DatasetPersistence } from "./Dataset";
import { Section } from "./Dataset";
// CPSC310 Query Engine Skeleton
// ------------------------------------------------------------
// This is a minimal, testable skeleton you can drop into your project
// and wire up to your dataset store. All TODOs are places you may need
// to adapt to your codebase (types, dataset access, error classes).
// ------------------------------------------------------------

// ========================= constants.ts =========================
export const NUMERIC_FIELDS = new Set(["avg", "pass", "fail", "audit", "year"]);
export const STRING_FIELDS = new Set(["dept", "id", "instructor", "title", "uuid"]);

// ========================= utils.ts =========================
export function isObject(x: unknown): x is Record<string, unknown> {
	return typeof x === "object" && x !== null && !Array.isArray(x);
}

export function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new InsightError(msg);
}

export function getDatasetAndField(key: string): { dataset: string; field: string } {
	const idx = key.indexOf("_");
	if (idx <= 0) throw new InsightError(`Invalid key '${key}'. Expected <id>_<field>.`);
	const dataset = key.slice(0, idx);
	const field = key.slice(idx + 1);
	return { dataset, field };
}

export function wildcardMatch(value: string, pattern: string): boolean {
	// pattern may be: literal | *literal | literal* | *literal*
	const starts = pattern.startsWith("*");
	const ends = pattern.endsWith("*");
	const core = pattern.substring(starts ? 1 : 0, ends ? pattern.length - 1 : pattern.length);
	if (pattern.includes("*", 1) && !ends) {
		// middle asterisks like input*string are not allowed by the spec
		throw new InsightError("Invalid wildcard placement in IS comparison");
	}
	if (starts && ends) return value.includes(core);
	if (starts) return value.endsWith(core);
	if (ends) return value.startsWith(core);
	return value === core;
}

// ========================= ast.ts =========================
// AST for the supported grammar. Keep it close to spec terms.
export type QueryAST = {
	type: "QUERY";
	where: FilterAST | { type: "EMPTY" };
	columns: string[]; // fully qualified keys
	order?: string; // optional, must be in columns
};

export type FilterAST =
	| { type: "AND"; children: FilterAST[] }
	| { type: "OR"; children: FilterAST[] }
	| { type: "NOT"; child: FilterAST }
	| { type: "LT" | "GT" | "EQ"; key: string; value: number }
	| { type: "IS"; key: string; pattern: string };

// ========================= parser.ts =========================
export function parseQuery(input: unknown): QueryAST {
	assert(isObject(input), "Query must be an object");

	// WHERE
	assert("WHERE" in input, "Missing WHERE block");
	const whereRaw = (input as any).WHERE;
	const where = parseWhere(whereRaw);

	// OPTIONS
	assert("OPTIONS" in input && isObject((input as any).OPTIONS), "Missing OPTIONS block");
	const optionsRaw = (input as any).OPTIONS as Record<string, unknown>;

	// COLUMNS
	assert(Array.isArray(optionsRaw.COLUMNS) && optionsRaw.COLUMNS.length > 0, "COLUMNS must be a non-empty array");
	const columns = optionsRaw.COLUMNS as unknown[];
	columns.forEach((k) => assert(typeof k === "string", "COLUMNS entries must be strings"));

	// ORDER (optional)
	let order: string | undefined;
	if (optionsRaw.ORDER !== undefined) {
		assert(typeof optionsRaw.ORDER === "string", "ORDER must be a string key");
		order = optionsRaw.ORDER as string;
	}

	// Build AST
	const ast: QueryAST = {
		type: "QUERY",
		where: where ?? { type: "EMPTY" },
		columns: columns as string[],
		order,
	};
	return ast;
}

function parseWhere(raw: unknown): FilterAST | undefined {
	if (!isObject(raw)) {
		// WHERE:{} allowed (match all)
		if (raw && typeof raw === "object") throw new InsightError("WHERE must be an object");
		return undefined;
	}
	const keys = Object.keys(raw);
	if (keys.length === 0) return undefined; // empty filter means match all
	assert(keys.length === 1, "WHERE must contain exactly one filter node");

	const tag = keys[0];
	const body = (raw as any)[tag];

	switch (tag) {
		case "AND":
		case "OR": {
			assert(Array.isArray(body) && body.length > 0, `${tag} must be a non-empty array`);
			const children = (body as unknown[]).map(parseWhereNode);
			return { type: tag, children } as FilterAST;
		}
		case "NOT": {
			assert(isObject(body), "NOT must wrap a single filter object");
			const child = parseWhere(body);
			assert(child !== undefined, "NOT cannot be empty");
			return { type: "NOT", child: child as FilterAST };
		}
		case "LT":
		case "GT":
		case "EQ": {
			assert(isObject(body) && Object.keys(body).length === 1, `${tag} must be an object with one key`);
			const key = Object.keys(body)[0];
			const value = (body as any)[key];
			assert(typeof value === "number", `${tag} comparator value must be a number`);
			return { type: tag, key, value } as FilterAST;
		}
		case "IS": {
			assert(isObject(body) && Object.keys(body).length === 1, "IS must be an object with one key");
			const key = Object.keys(body)[0];
			const value = (body as any)[key];
			assert(typeof value === "string", "IS comparison value must be a string");
			return { type: "IS", key, pattern: value };
		}
		default:
			throw new InsightError(`Unknown WHERE operator '${tag}'`);
	}
}

function parseWhereNode(node: unknown): FilterAST {
	assert(isObject(node), "Filter node must be an object");
	return parseWhere(node)!;
}

// ========================= validator.ts =========================
export function validateSemantics(ast: QueryAST) {
	// 1) All keys in WHERE, COLUMNS, ORDER must share exactly one dataset id
	const datasetIds = new Set<string>();
	const collectKey = (k: string) => datasetIds.add(getDatasetAndField(k).dataset);

	ast.columns.forEach(collectKey);
	if (ast.order) collectKey(ast.order);
	walkFilter(ast.where, (node) => {
		if (node.type === "LT" || node.type === "GT" || node.type === "EQ" || node.type === "IS") {
			collectKey(node.key);
		}
	});
	assert(datasetIds.size === 1, "Query must reference exactly one dataset id");

	// 2) Field types must match comparator types
	walkFilter(ast.where, (node) => {
		if (node.type === "LT" || node.type === "GT" || node.type === "EQ") {
			const { field } = getDatasetAndField(node.key);
			assert(NUMERIC_FIELDS.has(field), `${node.type} must use a numeric field`);
		}
		if (node.type === "IS") {
			const { field } = getDatasetAndField(node.key);
			assert(STRING_FIELDS.has(field), "IS must use a string field");
		}
	});

	// 3) ORDER, if present, must be one of COLUMNS
	if (ast.order) {
		assert(ast.columns.includes(ast.order), "ORDER key must appear in COLUMNS");
	}

	// 4) COLUMNS must all be valid keys
	ast.columns.forEach((key) => {
		const { field } = getDatasetAndField(key);
		assert(NUMERIC_FIELDS.has(field) || STRING_FIELDS.has(field), `Invalid column field '${field}'`);
	});
}

function walkFilter(node: FilterAST | { type: "EMPTY" }, f: (n: FilterAST) => void) {
	if (node.type === "EMPTY") return;
	switch (node.type) {
		case "AND":
		case "OR":
			node.children.forEach((c) => walkFilter(c, f));
			break;
		case "NOT":
			walkFilter(node.child, f);
			break;
		default:
			f(node);
	}
}

// ========================= executor.ts =========================
export async function executeQuery(ast: QueryAST, datasets: DatasetPersistence): Promise<InsightResult[]> {
	const datasetId = getDatasetAndField(ast.columns[0]).dataset; // safe after validateSemantics

	// have to implement getSectionsById()
	const rows = await datasets.getSectionsById(datasetId);

	// 1) Filter
	const filtered = rows.filter((r: any) => evalFilter(ast.where, r, datasetId));

	// 2) Project to columns
	const projected: InsightResult[] = filtered.map((r: { [x: string]: any }) => {
		const out: InsightResult = {};
		for (const key of ast.columns) {
			const { field } = getDatasetAndField(key);
			// @ts-ignore – fields line up with SectionRecord
			out[key] = r[field as keyof SectionRecord] as any;
		}
		return out;
	});

	// 3) Order
	if (ast.order) {
		const orderKey = ast.order;
		projected.sort((a, b) => compareValues(a[orderKey], b[orderKey]));
	}

	function compareValues(x: any, y: any): number {
		if (typeof x === "number" && typeof y === "number") return x - y;
		return String(x).localeCompare(String(y));
	}

	// 4) Size limit
	if (projected.length > 5000) throw new ResultTooLargeError();

	return projected;
}

function evalFilter(node: FilterAST | { type: "EMPTY" }, row: Section, datasetId: string): boolean {
	if (node.type === "EMPTY") return true;
	switch (node.type) {
		case "AND":
			return node.children.every((c) => evalFilter(c, row, datasetId));
		case "OR":
			return node.children.some((c) => evalFilter(c, row, datasetId));
		case "NOT":
			return !evalFilter(node.child, row, datasetId);
		case "LT":
			return compareNumeric(node, row);
		case "GT":
			return compareNumeric(node, row);
		case "EQ":
			return compareNumeric(node, row);
		case "IS":
			return compareString(node, row);
	}
}

function compareNumeric(node: Extract<FilterAST, { type: "LT" | "GT" | "EQ" }>, row: Section): boolean {
	const { field } = getDatasetAndField(node.key);
	const actual = (row as any)[field];
	if (typeof actual !== "number") throw new InsightError(`Field ${field} is not numeric`);
	if (node.type === "LT") return actual < node.value;
	if (node.type === "GT") return actual > node.value;
	return actual === node.value; // EQ
}

function compareString(node: Extract<FilterAST, { type: "IS" }>, row: Section): boolean {
	const { field } = getDatasetAndField(node.key);
	const actual = (row as any)[field];
	if (typeof actual !== "string") throw new InsightError(`Field ${field} is not string`);
	return wildcardMatch(actual, node.pattern);
}

// ========================= Notes =========================
// • This skeleton enforces: one dataset id across all keys, type-correct comparators, ORDER ∈ COLUMNS, <= 5000 results.
// • It recognizes: AND, OR, NOT, LT, GT, EQ, IS with prefix/suffix/contains wildcards (no middle asterisk).
// • Extend SectionRecord or create a RoomRecord if you later support rooms. The numeric/string field sets must be adjusted accordingly.
// • If your project splits by dataset kind, consider routing to a specific executor per kind.
