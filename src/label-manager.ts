import {
	AttributeValue,
	DataClient,
	Logger,
	TaskRunContext,
	WritablePlaylistClient,
} from "@pipe-bomb/plugin-sdk";
import { SearchClient } from "sublimate";
import { BeatportApi, BeatportLabel } from "./beatport.api.js";
import { LabelUserConfigManager } from "./label.user-config-manager.js";
import { createPlaylistCover } from "./utils.js";
import { extname } from "path";
import Axios from "axios";

export class LabelManager {
	public static readonly PLAYLIST_BOT_ID = "label";

	constructor(
		private readonly getSearchClient: () => Promise<SearchClient | null>,
		private readonly dataClient: DataClient,
		private readonly playlistClient: WritablePlaylistClient,
		private readonly logger: Logger,
		private readonly config: LabelUserConfigManager,
		private readonly api: BeatportApi,
	) {}

	private getPlaylistAttributes(label: BeatportLabel) {
		const attributes: AttributeValue[] = [
			{
				key: "title",
				value: label.name,
			},
			{
				key: "beatport_label_id",
				value: label.id,
			},
			{
				key: "beatport_label_slug",
				value: label.slug,
			},
		];

		if (label.image) {
			attributes.push({
				key: "thumb",
				value: {
					extension: extname(label.image.uri).substring(1),
					buffer: () =>
						Axios.get<Buffer>(label.image!.uri, {
							responseType: "arraybuffer",
						}).then(({ data }) => data),
				},
			});
		}

		return attributes;
	}

	public async sync(ctx: TaskRunContext) {
		const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);

		console.log("RUNNING!");
		const userCount = await this.dataClient.getUserCount();
		let iteratedUsers = 0;
		await this.dataClient.forEachUserId(async (userUuid) => {
			const userIndex = iteratedUsers++;
			ctx.update(userIndex / userCount);

			const rawLabelIds = await this.config.getLabelIds(userUuid);
			const validLabelIds = rawLabelIds
				.map((id) => Number(id))
				.filter((id) => Number.isInteger(id));

			for (const [labelIndex, labelId] of validLabelIds.entries()) {
				console.log(`Creating playlist for "${labelId}"`);
				try {
					const label = await this.api.getLabel(labelId);
					const releases = await this.api.getLabelReleasesSince(
						label.id,
						since,
						{
							excludePreOrders: true,
							maxPages: 2,
						},
					);
					console.log({ releases });
				} catch (e) {
					this.logger.error(
						`Failed to create Label playlist for "${labelId}":`,
						e,
					);
				}
			}
		});
	}
}
