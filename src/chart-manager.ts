import { AttributeValue, Logger, TaskRunContext } from "@pipe-bomb/plugin-sdk";
import { Chart } from "./chart/chart.js";
import { HouseChart } from "./chart/house.chart.js";
import { extractAttributes, getTrackTitle } from "./utils.js";
import { SearchClient } from "ephemeral-import/src/search-client.js";

export class ChartManager {
	private readonly charts: readonly Chart[] = [];

	constructor(
		private readonly getSearchClient: () => Promise<SearchClient | null>,
		private readonly logger: Logger,
	) {
		this.charts = [new HouseChart()];
	}

	public async sync(ctx: TaskRunContext) {
		const searchClient = await this.getSearchClient();
		if (!searchClient) {
			this.logger.warn(
				"Unable to generate charts because the ephemeral-import search client couldn't be retrieved. Is it installed?",
			);
			return;
		}

		for (const [index, chart] of this.charts.entries()) {
			ctx.update(index / this.charts.length);

			console.log(chart.getName());

			const top100 = await chart.getTop100();

			for (const [trackIndex, beatportTrack] of top100.entries()) {
				const attributes = extractAttributes(beatportTrack);
				const title = getTrackTitle(beatportTrack);

				this.logger.debug(`Finding a match for "${title}"...`);

				const result = await searchClient.findTrack({
					title,
					attributes,
				});

				console.log("Result:", result);

				if (trackIndex >= 3) {
					break;
				}
			}
		}
	}
}
