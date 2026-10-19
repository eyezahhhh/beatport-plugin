import { BufferAttributeValue } from "@pipe-bomb/plugin-sdk";
import { BeatportImage, BeatportTrack } from "./beatport.api.js";
import { SearchAttribute } from "sublimate";
import { extname } from "path";
import sharp from "sharp";
import { readFile } from "fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// const __filename = fileURLToPath(import.meta.url);
const __dirname = fileURLToPath(new URL(".", import.meta.url));

export function getTrackTitle(track: BeatportTrack) {
	let title = track.name;
	if (track.mix_name) {
		title += ` (${track.mix_name})`;
	}

	let artistName = "";
	for (let [index, artist] of track.artists.entries()) {
		if (index) {
			artistName += ", ";
		}
		artistName += artist.name;
	}
	if (artistName) {
		return `${artistName} - ${title}`;
	}
	return title;
}

export function extractAttributes(track: BeatportTrack): SearchAttribute[] {
	let title = track.name;
	if (track.mix_name) {
		title += ` (${track.mix_name})`;
	}

	const attributes: SearchAttribute[] = [
		{
			key: "duration",
			type: "decimal",
			value: track.length_ms / 1_000,
		},
		{
			key: "bpm",
			type: "decimal",
			value: track.bpm,
		},
		{
			key: "title",
			type: "string",
			value: title,
		},
	];

	if (track.isrc) {
		attributes.push({
			key: "isrc",
			type: "string",
			value: track.isrc,
		});
	}

	if (track.release?.name) {
		attributes.push({
			key: "album",
			type: "string",
			value: track.release.name,
		});
	}

	if (track.genre?.name) {
		attributes.push({
			key: "genre",
			type: "string",
			value: track.genre.name,
		});
	}

	if (track.sub_genre?.name) {
		attributes.push({
			key: "genre",
			type: "string",
			value: track.sub_genre.name,
		});
	}

	if (track.release?.label?.name) {
		attributes.push({
			key: "label",
			type: "string",
			value: track.release.label.name,
		});
	}

	return attributes;
}

const COVER_SIZE = 1_400;

export function createPlaylistCover(
	image: BeatportImage,
): BufferAttributeValue {
	const url = image.uri;
	const extension = extname(url).substring(1);

	return {
		extension,
		buffer: async () => {
			const backgroundRawBuffer = await fetch(url).then((r) => r.arrayBuffer());

			const logoRawBuffer = await readFile(
				path.join(__dirname, "../assets/logo-icon-white.svg"),
			);
			const logoSharp = await sharp(logoRawBuffer)
				.resize(COVER_SIZE * 0.8, COVER_SIZE * 0.8, {
					fit: "cover",
				})
				.toBuffer();

			return await sharp(backgroundRawBuffer)
				.resize(COVER_SIZE, COVER_SIZE, {
					fit: "cover",
				})
				.blur(10)
				.modulate({ brightness: 0.55 })
				.composite([
					{
						input: logoSharp,
						gravity: "center",
					},
				])
				.jpeg({ quality: 85 })
				.toBuffer();
		},
	};
}
