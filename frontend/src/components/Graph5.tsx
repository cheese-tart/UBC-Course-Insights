import type { InsightDataset, InsightResult } from "../../../src/controller/IInsightFacade.ts";
import { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import { postQuery } from "../Service.tsx";

export default function Graph5(props: { dataset: InsightDataset }) {
	const id = props.dataset.id;
	const [data, setData] = useState<{ year: number; avg: number }[]>([]);

	const getCourses = async () => {
		const query = await avgGradesByYear(id);

		if (!query || query.length === 0) {
			setData([]);
		} else {
			setData(
				query!
					.filter((x) => x[id + "_year"] !== 1900)
					.map((x) => ({
						year: x[id + "_year"] as number,
						avg: x.avgGrade as number,
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
						label: "Average Grade Across All Courses",
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
							text: "Year",
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

async function avgGradesByYear(id: string): Promise<InsightResult[] | undefined> {
	try {
		return await postQuery({
			WHERE: {},
			OPTIONS: {
				COLUMNS: [id + "_year", "avgGrade"],
				ORDER: {
					dir: "UP",
					keys: [id + "_year"],
				},
			},
			TRANSFORMATIONS: {
				GROUP: [id + "_year"],
				APPLY: [
					{
						avgGrade: {
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
