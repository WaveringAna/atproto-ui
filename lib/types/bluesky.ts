// Re-export precise lexicon types from @atcute/bluesky instead of redefining.
import type { AppBskyFeedPost, AppBskyActorProfile } from '@atcute/bluesky';

// The atcute lexicon modules expose Main interface for record input shapes.
export type FeedPostRecord = AppBskyFeedPost.Main;
export type ProfileRecord = AppBskyActorProfile.Main;
