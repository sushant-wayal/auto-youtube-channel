export interface YouTubeComment {
    id: string;
    authorDisplayName: string;
    authorChannelId?: string | null;
    authorProfileImageUrl?: string;
    textOriginal: string;
    likeCount: number;
    publishedAt: string;
    updatedAt: string;
}

export interface YouTubeCommentThread {
    threadId: string;
    videoId: string;
    topLevelComment: YouTubeComment;
    totalReplyCount: number;
    canReply: boolean;
    existingReplies: YouTubeComment[];
}

export interface VideoMetadata {
    id: string;
    title: string;
    description: string;
    publishedAt?: string;
    tags?: string[];
    transcript?: string | null;
}

export type CommentCategory =
    | 'question'
    | 'feedback'
    | 'compliment'
    | 'critique'
    | 'spam'
    | 'toxic'
    | 'other';

export type CommentSentiment = 'positive' | 'neutral' | 'negative';

export interface AIReplyDecision {
    shouldReply: boolean;
    category: CommentCategory;
    sentiment: CommentSentiment;
    replyText?: string;
    confidence: number;
    reason?: string;
}

export interface CommentReplySettings {
    enabled: boolean;
    dryRun: boolean;
    maxRepliesPerRun: number;
    tone: 'friendly' | 'professional' | 'technical' | 'enthusiastic';
    customInstructions?: string;
    replyToQuestionsOnly?: boolean;
}

export interface ReplyHistoryEntry {
    id: string;
    threadId: string;
    commentId: string;
    videoId: string;
    videoTitle: string;
    authorName: string;
    commentText: string;
    replyText: string;
    category: CommentCategory;
    sentiment: CommentSentiment;
    status: 'posted' | 'dry_run' | 'skipped' | 'failed';
    error?: string;
    timestamp: string;
}

export interface CommentReplyWorkerResult {
    success: boolean;
    totalChecked: number;
    repliesSent: number;
    repliesDryRun: number;
    repliesSkipped: number;
    errors: string[];
    processedReplies: ReplyHistoryEntry[];
}
