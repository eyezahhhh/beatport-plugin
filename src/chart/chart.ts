import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const BEATPORT_URL = "https://www.beatport.com";
const USER_AGENT =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface BeatportGenre {
	id: number;
	name: string;
	slug: string;
}

export interface BeatportArtist {
	id: number;
	name: string;
	slug: string;
}

export interface BeatportTrack {
	id: number;
	name: string;
	mix_name: string | null;
	slug: string;
	bpm: number;
	length_ms: number;
	is_explicit: boolean;
	sample_url: string;
	artists: BeatportArtist[];
	genre: BeatportGenre | null;
	sub_genre: BeatportGenre | null;
	isrc?: string;
}

interface DehydratedQuery {
	queryKey: unknown[];
	state: {
		data?: unknown;
	};
}

interface NextData {
	props: {
		pageProps: {
			dehydratedState?: {
				queries: DehydratedQuery[];
			};
		};
	};
}

export abstract class Chart {
	constructor(
		protected readonly genreId: number,
		private readonly name: string,
	) {}

	getName() {
		return this.name;
	}

	async getTop100(): Promise<BeatportTrack[]> {
		const html = await this.fetchHtml(`/genre/x/${this.genreId}/top-100`);
		const query = this.parseNextData(
			html,
		).props.pageProps.dehydratedState?.queries.find(
			(candidate) =>
				typeof candidate.queryKey[0] === "string" &&
				candidate.queryKey[0].startsWith(
					`genre-${this.genreId}-top-100-tracks`,
				),
		);

		const results = (
			query?.state.data as { results?: BeatportTrack[] } | undefined
		)?.results;
		if (!results) {
			throw new Error(
				`Could not find the Beatport top 100 for genre ${this.genreId}`,
			);
		}

		return results;
	}

	private async fetchHtml(path: string): Promise<string> {
		try {
			const { stdout } = await execFileAsync(
				"curl",
				[
					"-sSL",
					"-f",
					"--compressed",
					"-A",
					USER_AGENT,
					"-H",
					"Accept-Language: en-US,en;q=0.9",
					`${BEATPORT_URL}${path}`,
				],
				{ maxBuffer: 64 * 1024 * 1024 },
			);
			return stdout;
		} catch (error) {
			throw new Error(`Beatport request to ${path} failed: ${error}`);
		}
	}

	private parseNextData(html: string): NextData {
		const match = html.match(
			/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
		);
		if (!match?.[1]) {
			throw new Error("Could not find __NEXT_DATA__ in Beatport response");
		}

		return JSON.parse(match[1]) as NextData;
	}
}
