import type { ShTangledRepo, ShTangledString } from "@atcute/tangled";

export type TangledRepoRecord = ShTangledRepo.Main;
export type TangledStringRecord = ShTangledString.Main;

/** Language information from sh.tangled.repo.languages endpoint */
export interface RepoLanguage {
	name: string;
	percentage: number;
	size: number;
}

/**
 * Response from sh.tangled.repo.languages endpoint from tangled knot
 */
export interface RepoLanguagesResponse {
	languages: RepoLanguage[];
	/** Branch name */
	ref: string;
	totalFiles: number;
	totalSize: number;
}
