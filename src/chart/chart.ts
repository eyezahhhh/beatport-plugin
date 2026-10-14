import { BeatportApi, BeatportGenre, BeatportTrack } from "../beatport.api.js";

export class Chart {
	constructor(
		private readonly genre: BeatportGenre,
		private readonly api: BeatportApi,
	) {}

	getGenreId(): number {
		return this.genre.id;
	}

	getName(): string {
		return this.genre.name;
	}

	getSlug(): string {
		return this.genre.slug;
	}

	getCategory(): string | null {
		return this.genre.category?.name ?? null;
	}

	getSubGenres(): string[] {
		return (this.genre.sub_genres ?? []).map((subGenre) => subGenre.name);
	}

	async getTop100(): Promise<BeatportTrack[]> {
		return this.api.getTop100(this.genre.id);
	}
}
