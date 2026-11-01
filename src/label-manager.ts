import {
	AttributeValue,
	DataClient,
	Logger,
	TaskRunContext,
	WritablePlaylistClient,
} from "@pipe-bomb/plugin-sdk";
import { SearchAttribute, SearchClient } from "sublimate";
import { BeatportApi, BeatportLabel } from "./beatport.api.js";
import { LabelUserConfigManager } from "./label.user-config-manager.js";
import { extractAttributes, getTrackTitle } from "./utils.js";
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
		const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 * 12);

		const searchClient = await this.getSearchClient();
		if (!searchClient) {
			this.logger.warn(
				"Unable to generate label playlists because the sublimate search client couldn't be retrieved. Is it installed?",
			);
			return;
		}

		const playlistUuids = new Map<number, { uuid: string; users: string[] }>();
		const uuids = await this.playlistClient.getBotPlaylistUuids(
			"beatport",
			LabelManager.PLAYLIST_BOT_ID,
		);
		for (const uuid of uuids) {
			const playlist = await this.playlistClient.getPlaylist(uuid, {
				relations: {
					attributes: true,
				},
			});
			const attribute = playlist?.attributes?.find(
				(a) => a.key == "beatport_label_id" && a.type == "integer",
			);
			if (attribute && attribute.type == "integer" && attribute.values.length) {
				const labelId = attribute.values[0]!;
				playlistUuids.set(labelId, { uuid, users: [] });
			}
		}

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
				let playlistUuid = playlistUuids.get(labelId);
				if (playlistUuid?.users.length) {
					if (!playlistUuid.users.includes(userUuid)) {
						playlistUuid.users.push(userUuid);
					}
					continue;
				}

				console.log(`Creating playlist for "${labelId}"`);

				try {
					const label = await this.api.getLabel(labelId);
					const { tracks } = await this.api.getLabelTracksSince(label.id, {
						since,
						excludePreOrders: true,
						maxTracks: 100,
						maxReleases: 10,
					});
					console.log({ tracks }, tracks.length);
					const trackUuids: string[] = [];

					for (const [trackIndex, beatportTrack] of tracks.entries()) {
						const attributes = extractAttributes(beatportTrack);
						const title = getTrackTitle(beatportTrack);
						const artists: SearchAttribute[][] = beatportTrack.artists.map(
							(artist) => [{ key: "name", type: "string", value: artist.name }],
						);
						const album: SearchAttribute[] | undefined = beatportTrack.release
							?.name
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

					console.log(trackUuids);

					if (playlistUuid) {
						if (!playlistUuid.users.length) {
							await this.playlistClient.updatePlaylistAttributes(
								playlistUuid.uuid,
								"beatport",
								this.getPlaylistAttributes(label),
							);
							await this.playlistClient.updatePlaylistVisibility(
								playlistUuid.uuid,
								"unlisted",
							);
						}
						playlistUuid.users.push(userUuid);
					} else {
						const uuid = await this.playlistClient.createPlaylist({
							visibility: "unlisted",
							attributes: {
								sourceId: "beatport",
								attributes: this.getPlaylistAttributes(label),
							},
						});
						playlistUuid = {
							uuid,
							users: [userUuid],
						};
						playlistUuids.set(labelId, playlistUuid);
					}

					const playlist = await this.playlistClient.getPlaylist(
						playlistUuid.uuid,
						{
							relations: {
								tracks: true,
							},
						},
					);
					if (playlist?.tracks?.length) {
						await this.playlistClient.removeFromPlaylist(
							playlist.uuid,
							playlist.tracks.map((entry) => entry.trackUuid),
						);
					}
					await this.playlistClient.addToPlaylist(
						playlistUuid.uuid,
						trackUuids,
					);
				} catch (e) {
					this.logger.error(
						`Failed to create Label playlist for "${labelId}":`,
						e,
					);
				}
			}
		});

		for (const { uuid, users } of playlistUuids.values()) {
			if (users.length) {
				const members = await this.playlistClient.getPlaylistMembers(uuid);
				const toRemove = new Set<string>(
					members.map((member) => member.userUuid),
				);
				const toAdd = new Set<string>(users);
				for (const member of members) {
					toAdd.delete(member.userUuid);
					if (users.includes(member.userUuid)) {
						toRemove.delete(member.userUuid);
					} else if (member.role != "viewer") {
						await this.playlistClient.addPlaylistMember(
							uuid,
							member.userUuid,
							"viewer",
						);
					}
				}
				for (const userUuid of toRemove) {
					await this.playlistClient.removePlaylistMember(uuid, userUuid);
				}
				for (const userUuid of toAdd) {
					await this.playlistClient.addPlaylistMember(uuid, userUuid, "viewer");
				}
			} else {
				await this.playlistClient.deletePlaylist(uuid);
			}
		}
	}
}
