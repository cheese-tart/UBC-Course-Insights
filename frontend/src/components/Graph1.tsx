import type { InsightDataset, InsightResult } from "../../../src/controller/IInsightFacade.ts";
import { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import { postQuery } from "../Service.tsx";

export default function Graph1(props: { dataset: InsightDataset }) {
	const id = props.dataset.id;
	const [data, setData] = useState<{ year: number; avg: number }[]>([]);

	const getCourses = async () => {
		const query = await gregorQuery(id);

		if (!query || query.length === 0) {
			setData([]);
		} else {
			setData(
				query!.map((x) => ({
					year: x[id + "_year"] as number,
					avg: x.avgMark as number,
				}))
			);
		}
	};

	useEffect(() => {
		getCourses();
	}, [props.dataset, props.dataset.id]);

	return (
		<Bar
			data={{
				labels: data.map((x) => x.year),
				datasets: [
					{
						label: "CPSC 110 Average of All Sections Taught by GREGOR",
						data: data.map((x) => x.avg),
						backgroundColor: "#646cff",
						borderColor: "lightgray",
					},
				],
			}}
			options={{
				responsive: true,
				scales: {
					x: {
						title: {
							display: true,
							text: "Years that GREGOR taught",
							color: "gray",
							font: { size: 16 },
						},
						grid: {
							color: "gray", // grid line color
						},
						ticks: {
							color: "gray",
							autoSkip: false,
							maxRotation: 90,
							minRotation: 0,
						},
					},
					y: {
						title: {
							display: true,
							text: "Average Grade in %",
							color: "gray",
							font: { size: 14 },
						},
						grid: {
							color: "gray",
						},
						ticks: {
							color: "gray",
						},
					},
				},
			}}
		/>
	);
}

async function gregorQuery(id: string): Promise<InsightResult[] | undefined> {
	try {
		return await postQuery({
			WHERE: {
				AND: [
					{
						IS: {
							[id + "_instructor"]: "*kiczales*",
						},
					},
					{
						IS: {
							[id + "_dept"]: "cpsc",
						},
					},
					{
						IS: {
							[id + "_id"]: "110",
						},
					},
				],
			},
			OPTIONS: {
				COLUMNS: [id + "_year", "avgMark"],
				ORDER: {
					dir: "UP",
					keys: [id + "_year"],
				},
			},
			TRANSFORMATIONS: {
				GROUP: [id + "_year"],
				APPLY: [
					{
						avgMark: {
							AVG: id + "_avg",
						},
					},
				],
			},
		});
	} catch (e) {
		console.error((e as any)?.message ?? e);
		return undefined;
	}
}
