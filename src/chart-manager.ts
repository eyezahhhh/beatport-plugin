import {
	AttributeValue,
	DataClient,
	Logger,
	TaskRunContext,
	WritablePlaylistClient,
} from "@pipe-bomb/plugin-sdk";
import {
	BeatportApi,
	BeatportGenre,
	BeatportImage,
	BeatportTrack,
} from "./beatport.api.js";
import { BeatportConfigManager } from "./beatport.config-manager.js";
import { Chart } from "./chart/chart.js";
import {
	createPlaylistCover,
	extractAttributes,
	getTrackTitle,
} from "./utils.js";
import { SearchClient } from "ephemeral-import/src/search-client.js";
import { SearchAttribute } from "ephemeral-import/src/attribute-entry.js";

export class ChartManager {
	public static readonly PLAYLIST_BOT_ID = "chart";

	constructor(
		private readonly getSearchClient: () => Promise<SearchClient | null>,
		private readonly dataClient: DataClient,
		private readonly playlistClient: WritablePlaylistClient,
		private readonly logger: Logger,
		private readonly config: BeatportConfigManager,
		private readonly api: BeatportApi,
	) {}

	private async getCharts(): Promise<Chart[]> {
		const genreIds = this.config.getGenreIds();
		if (!genreIds.length) {
			this.logger.warn(
				"No Beatport genre IDs are configured, so no charts will be created.",
			);
			try {
				const genres = await this.api.getGenres();
				this.logger.log(
					`Available Beatport genres: ${this.formatGenres(genres)}`,
				);
			} catch (error) {
				this.logger.debug(
					"Could not list the available Beatport genres.",
					error,
				);
			}
			return [];
		}

		const genres = await this.api.getGenres();
		const byId = new Map(genres.map((genre) => [genre.id, genre]));

		const charts: Chart[] = [];
		for (const genreId of genreIds) {
			const genre = byId.get(genreId);
			if (!genre) {
				this.logger.warn(`Beatport genre ${genreId} does not exist, skipping.`);
				continue;
			}
			if (genre.enabled === false) {
				this.logger.warn(`Beatport genre ${genreId} is disabled, skipping.`);
				continue;
			}
			charts.push(new Chart(genre, this.api));
		}

		this.logger.debug(
			`Selected ${charts.length} Beatport genre(s) for charts.`,
		);
		return charts;
	}

	private formatGenres(genres: BeatportGenre[]): string {
		return genres.map((genre) => `${genre.id} = ${genre.name}`).join(", ");
	}

	private getPlaylistAttributes(
		chart: Chart,
		image: BeatportImage | null,
	): AttributeValue[] {
		const attributes: AttributeValue[] = [
			{
				key: "title",
				value: `${chart.getName()} Top 100`,
			},
			{
				key: "beatport_genre_id",
				value: chart.getGenreId(),
			},
			{
				key: "beatport_genre_slug",
				value: chart.getSlug(),
			},
			{
				key: "beatport_genre_category",
				value: chart.getCategory() ?? "",
			},
			{
				key: "beatport_sub_genres",
				value: chart.getSubGenres().join(", "),
			},
		];

		if (image) {
			attributes.push({
				key: "thumb",
				value: createPlaylistCover(image),
			});
		}

		return attributes;
	}

	private async getPlaylistIds(
		validGenreIds: number[],
	): Promise<Map<number, string>> {
		const playlistUuids = new Map<number, string>();

		const uuids = await this.playlistClient.getBotPlaylistUuids(
			"beatport",
			ChartManager.PLAYLIST_BOT_ID,
		);

		for (const uuid of uuids) {
			const playlist = await this.playlistClient.getPlaylist(uuid, {
				relations: {
					attributes: true,
				},
			});
			const attribute = playlist?.attributes?.find(
				(a) => a.key == "beatport_genre_id" && a.type == "integer",
			);
			if (attribute && attribute.type == "integer" && attribute.values.length) {
				const genreId = attribute.values[0]!;
				if (validGenreIds.includes(genreId)) {
					playlistUuids.set(genreId, playlist!.uuid);
				} else {
					this.logger.debug(
						`Found orphaned playlist "${playlist!.uuid}", deleting.`,
					);
					await this.playlistClient.deletePlaylist(playlist!.uuid);
				}
			} else {
				this.logger.debug(
					`Found orphaned playlist "${playlist!.uuid}", deleting.`,
				);
				await this.playlistClient.deletePlaylist(playlist!.uuid);
			}
		}

		return playlistUuids;
	}

	public async sync(ctx: TaskRunContext) {
		const charts = await this.getCharts();

		const playlistIds = await this.getPlaylistIds(
			charts.map((chart) => chart.getGenreId()),
		);

		if (!charts.length) {
			return;
		}

		const searchClient = await this.getSearchClient();
		if (!searchClient) {
			this.logger.warn(
				"Unable to generate charts because the ephemeral-import search client couldn't be retrieved. Is it installed?",
			);
			return;
		}

		const chartPercentSize = 1 / charts.length;
		for (const [index, chart] of charts.entries()) {
			ctx.update(chartPercentSize * index);

			const top100 = await chart.getTop100();
			if (!top100.length) {
				continue;
			}

			const trackUuids: string[] = [];

			for (const [trackIndex, beatportTrack] of top100.entries()) {
				ctx.update(
					chartPercentSize * index +
						(chartPercentSize / top100.length) * trackIndex,
				);
				const attributes = extractAttributes(beatportTrack);
				const title = getTrackTitle(beatportTrack);
				const artists: SearchAttribute[][] = beatportTrack.artists.map(
					(artist) => [{ key: "name", type: "string", value: artist.name }],
				);
				const album: SearchAttribute[] | undefined = beatportTrack.release?.name
					? [
							{
								key: "title",
								type: "string",
								value: beatportTrack.release.name,
							},
						]
					: undefined;

				this.logger.debug(`Finding a match for "${title}"...`);

				const result = await searchClient.findTrack({
					title,
					artists,
					album,
					attributes,
				});

				if (result) {
					if (result.ephemeral) {
						const trackUuid = await this.dataClient.saveTrack(
							{
								pluginId: result.source.pluginId,
								libraryId: result.source.source.getLibraryHandler().id,
								trackId: result.track.id,
							},
							null,
						);
						if (trackUuid && !trackUuids.includes(trackUuid)) {
							trackUuids.push(trackUuid);
						}
					} else if (!trackUuids.includes(result.track.uuid)) {
						trackUuids.push(result.track.uuid);
					}
				}
			}

			let beatportImage: BeatportImage | null = null;
			for (const track of top100) {
				if (track.release?.image) {
					beatportImage = track.release.image;
					break;
				}
			}
			const attributes = this.getPlaylistAttributes(chart, beatportImage);
			let playlistId = playlistIds.get(chart.getGenreId());
			if (playlistId) {
				await this.playlistClient.updatePlaylistAttributes(
					playlistId,
					"beatport",
					attributes,
				);
				await this.playlistClient.updatePlaylistVisibility(
					playlistId,
					"public",
				);
				const playlist = await this.playlistClient.getPlaylist(playlistId, {
					relations: {
						tracks: true,
					},
				});
				if (playlist?.tracks?.length) {
					await this.playlistClient.removeFromPlaylist(
						playlist.uuid,
						playlist.tracks.map((entry) => entry.trackUuid),
					);
				}
			} else {
				playlistId = await this.playlistClient.createPlaylist({
					attributes: {
						sourceId: "beatport",
						attributes,
					},
					visibility: "public",
				});
			}
			await this.playlistClient.addToPlaylist(playlistId, trackUuids);
		}
	}
}
