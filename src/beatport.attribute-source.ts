import {
	AlbumInformationHelper,
	AlbumMetadata,
	ArtistInformationHelper,
	ArtistMetadata,
	AttributeSource,
	AttributeSourceApiContext,
	TrackAttributionHelper,
	TrackMetadata,
} from "@pipe-bomb/plugin-sdk";

export class BeatportAttributeSource implements AttributeSource {
	readonly id: string = "beatport";

	enable(ctx: AttributeSourceApiContext): void {
		ctx.registerPlaylistAttributes([
			{
				key: "title",
				type: "string",
				supportsMultiple: false,
			},
			{
				key: "beatport_genre_id",
				type: "integer",
				supportsMultiple: false,
			},
			{
				key: "beatport_genre_slug",
				type: "string",
				supportsMultiple: false,
			},
			{
				key: "beatport_genre_category",
				type: "string",
				supportsMultiple: false,
			},
			{
				key: "beatport_sub_genres",
				type: "string",
				supportsMultiple: false,
			},
			{
				key: "thumb",
				type: "buffer",
				supportsMultiple: false,
			},
		]);
	}
	getName(): string {
		return "Beatport";
	}

	async getTrackAttributeValues(
		_helper: TrackAttributionHelper,
	): Promise<TrackMetadata> {
		return {
			artists: null,
			attributes: null,
		};
	}

	async getArtistAttributeValues(
		_helper: ArtistInformationHelper,
	): Promise<ArtistMetadata> {
		return {
			attributes: null,
		};
	}

	async getAlbumAttributeValues(
		_helper: AlbumInformationHelper,
	): Promise<AlbumMetadata> {
		return {
			artists: null,
			attributes: null,
		};
	}
}
