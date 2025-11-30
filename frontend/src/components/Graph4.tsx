import type { InsightDataset, InsightResult } from "../../../src/controller/IInsightFacade.ts";
import { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import { postQuery } from "../Service.tsx";

export default function Graph4(props: { dataset: InsightDataset }) {
	const id = props.dataset.id;
	const [data, setData] = useState<{ year: number; enrollment: number }[]>([]);

	const getCourses = async () => {
		const query = await csOversturation(id);

		if (!query || query.length === 0) {
			setData([]);
		} else {
			setData(
				query!
					.filter((x) => x[id + "_year"] !== 1900)
					.map((x) => ({
						year: x[id + "_year"] as number,
						enrollment: Number(x.totalPassed) + Number(x.totalFailed) + Number(x.totalAudited),
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
						label: "Total Enrollment Across All CPSC Courses",
						data: data.map((x) => x.enrollment),
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
							text: "Number of Students",
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

async function csOversturation(id: string): Promise<InsightResult[] | undefined> {
	try {
		return await postQuery({
			WHERE: {
				IS: {
					[id + "_dept"]: "cpsc",
				},
			},
			OPTIONS: {
				COLUMNS: [id + "_year", "totalPassed", "totalFailed", "totalAudited"],
				ORDER: {
					dir: "UP",
					keys: [id + "_year"],
				},
			},
			TRANSFORMATIONS: {
				GROUP: [id + "_year"],
				APPLY: [
					{
						totalPassed: {
							SUM: id + "_pass",
						},
					},
					{
						totalFailed: {
							SUM: id + "_fail",
						},
					},
					{
						totalAudited: {
							SUM: id + "_audit",
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
