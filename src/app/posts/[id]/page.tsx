"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  Calendar,
  Check,
  ChevronDown,
  Expand,
  MapPin,
  Play,
  Plus,
  Send,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { DynamicMapboxMap } from "@/components/DynamicMapboxMap";
import { MobileFrame } from "@/components/MobileFrame";
import { PostMediaPreview } from "@/components/PostMediaPreview";
import { deleteAppPost, fetchAppPostById, fetchAppPosts, type AppPost } from "@/lib/posts";
import { createPostComment, fetchPostComments, type AppPostComment } from "@/lib/postComments";
import type { Experience } from "@/lib/data";
import { createAppBoard, fetchBoardsByAccount, savePostToBoard, type AppBoard } from "@/lib/boards";
import { fetchFollowingIds, readAccountSessionId, setAccountFollow } from "@/lib/accounts";
import { writeActionBanner } from "@/lib/actionBanner";

const appPostsCacheKey = "odyssey-app-posts-cache-v2";
const profilePostsCachePrefix = "odyssey-profile-posts-cache-v1";
const postDetailCachePrefix = "odyssey-post-detail-cache-v1";

export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [post, setPost] = useState<AppPost | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [boards, setBoards] = useState<AppBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveOpen, setSaveOpen] = useState(false);
  const [newBoardOpen, setNewBoardOpen] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState("");
  const [newBoardSubtitle, setNewBoardSubtitle] = useState("");
  const [saveStatus, setSaveStatus] = useState<"ready" | "saving">("ready");
  const [saveMessage, setSaveMessage] = useState("");
  const [comments, setComments] = useState<AppPostComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentStatus, setCommentStatus] = useState<"idle" | "loading" | "saving">("loading");
  const [commentMessage, setCommentMessage] = useState("");
  const [replyTarget, setReplyTarget] = useState<AppPostComment | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [expandedMediaIndex, setExpandedMediaIndex] = useState<number | null>(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [isFollowingAuthor, setIsFollowingAuthor] = useState(false);
  const [followStatus, setFollowStatus] = useState<"ready" | "saving">("ready");
  const mediaScrollerRef = useRef<HTMLDivElement | null>(null);
  const expandedMediaScrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    const viewerId = readAccountSessionId();
    const cachedPost = readCachedPost(params.id);

    setAccountId(viewerId);

    if (cachedPost) {
      setPost(cachedPost);
      setLoading(false);
    }

    withTimeout(fetchAppPostById(params.id), 8000)
      .then((nextPost) => {
        if (active) {
          setPost(nextPost);
          if (nextPost) {
            writeCachedPost(nextPost);
          }
          setLoading(false);
        }
      })
      .catch(async () => {
        try {
          const posts = await withTimeout(fetchAppPosts(), 8000);
          const fallbackPost = posts.find((item) => item.id === params.id) ?? null;

          if (active) {
            if (fallbackPost) {
              setPost(fallbackPost);
              writeCachedPost(fallbackPost);
              writeCachedAppPosts(posts);
            }
            setLoading(false);
          }
        } catch {
          if (active) {
            setLoading(false);
          }
        }
      });

    return () => {
      active = false;
    };
  }, [params.id]);

  useEffect(() => {
    let active = true;

    setCommentStatus("loading");
    setCommentMessage("");

    fetchPostComments(params.id)
      .then((nextComments) => {
        if (active) {
          setComments(nextComments);
          setCommentStatus("idle");
        }
      })
      .catch((error) => {
        if (active) {
          setCommentMessage(formatError(error));
          setCommentStatus("idle");
        }
      });

    return () => {
      active = false;
    };
  }, [params.id]);

  useEffect(() => {
    if (!accountId) {
      return;
    }

    let active = true;

    fetchBoardsByAccount(accountId)
      .then((nextBoards) => {
        if (active) {
          setBoards(nextBoards);
        }
      })
      .catch((error) => {
        if (active) {
          setSaveMessage(formatError(error));
        }
      });

    return () => {
      active = false;
    };
  }, [accountId]);

  useEffect(() => {
    if (!accountId || !post || accountId === post.accountId) {
      setIsFollowingAuthor(false);
      return;
    }

    let active = true;

    fetchFollowingIds(accountId)
      .then((ids) => {
        if (active) {
          setIsFollowingAuthor(ids.includes(post.accountId));
        }
      })
      .catch(() => {
        if (active) {
          setIsFollowingAuthor(false);
        }
      });

    return () => {
      active = false;
    };
  }, [accountId, post]);

  const mapExperience = useMemo<Experience | null>(() => {
    if (!post) {
      return null;
    }

    return {
      alsoExperiencedBy: [],
      caption: post.caption,
      coordinates: post.coordinates,
      id: post.id,
      imageUrl: post.imageUrl ?? "/hawaii-reference-map.png",
      island: post.location,
      location: post.location,
      name: post.title,
      slug: post.id,
      tripId: post.id,
      userId: post.accountId,
    };
  }, [post]);
  const postMediaUrls = useMemo(() => (post ? (post.mediaUrls.length ? post.mediaUrls : post.imageUrl ? [post.imageUrl] : []) : []), [post]);
  const postMediaItems = useMemo(
    () =>
      postMediaUrls.map((url, index) => ({
        mediaType: post?.mediaTypes[index] ?? "image",
        url,
      })),
    [post?.mediaTypes, postMediaUrls],
  );
  const commentMentionTarget = replyTarget?.username ?? null;
  const resolvedCommentBody = commentBodyWithMention(commentDraft, commentMentionTarget);
  const topLevelComments = useMemo(() => {
    const commentIds = new Set(comments.map((comment) => comment.id));

    return comments.filter((comment) => !comment.replyToCommentId || !commentIds.has(comment.replyToCommentId));
  }, [comments]);
  const visibleCommentRoots = topLevelComments.length ? topLevelComments : comments;
  const repliesByCommentId = useMemo(() => {
    const commentIds = new Set(comments.map((comment) => comment.id));
    const nextReplies = new Map<string, AppPostComment[]>();

    comments.forEach((comment) => {
      if (!comment.replyToCommentId || !commentIds.has(comment.replyToCommentId)) {
        return;
      }

      const existingReplies = nextReplies.get(comment.replyToCommentId) ?? [];
      nextReplies.set(comment.replyToCommentId, [...existingReplies, comment]);
    });

    nextReplies.forEach((replies, commentId) => {
      nextReplies.set(
        commentId,
        [...replies].sort((first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime()),
      );
    });

    return nextReplies;
  }, [comments]);

  useEffect(() => {
    const scroller = mediaScrollerRef.current;

    if (!scroller) {
      return;
    }

    scroller.querySelectorAll<HTMLVideoElement>("video[data-post-detail-media]").forEach((video) => {
      const mediaIndex = Number(video.dataset.mediaIndex);
      const isActive = mediaIndex === activePhotoIndex;

      video.muted = true;

      if (!isActive) {
        video.pause();
        return;
      }

      void video.play().catch(() => {
        // If autoplay is blocked, the visible native controls can still start playback.
      });
    });
  }, [activePhotoIndex, postMediaItems]);

  useEffect(() => {
    if (expandedMediaIndex === null) {
      return;
    }

    const scroller = expandedMediaScrollerRef.current;

    scroller?.scrollTo({ left: scroller.clientWidth * expandedMediaIndex });
  }, [expandedMediaIndex]);

  if (loading) {
    return (
      <MobileFrame>
        <main className="grid h-full place-items-center bg-shell px-8 text-center">
          <p className="text-sm font-black text-ink/52">Loading post...</p>
        </main>
        <BottomNav />
      </MobileFrame>
    );
  }

  if (!post || !mapExperience) {
    return (
      <MobileFrame>
        <main className="grid h-full place-items-center bg-shell px-8 text-center">
          <div>
            <UserRound aria-hidden="true" className="mx-auto text-ink/38" size={42} />
            <h1 className="mt-3 text-2xl font-black text-ink">Post not found</h1>
            <Link className="mt-5 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-black text-white" href="/explore">
              Back to Explore
            </Link>
          </div>
        </main>
        <BottomNav />
      </MobileFrame>
    );
  }

  const savedBoardIds = boards.filter((board) => board.postIds.includes(post.id)).map((board) => board.id);
  const isSaved = savedBoardIds.length > 0;
  function showPhotoAt(index: number) {
    const scroller = mediaScrollerRef.current;

    setActivePhotoIndex(index);
    scroller?.scrollTo({ behavior: "smooth", left: scroller.clientWidth * index });
  }

  function handleMediaScroll() {
    const scroller = mediaScrollerRef.current;

    if (!scroller) {
      return;
    }

    const nextIndex = Math.round(scroller.scrollLeft / Math.max(scroller.clientWidth, 1));

    setActivePhotoIndex(Math.min(Math.max(nextIndex, 0), postMediaUrls.length - 1));
  }

  function handleExpandedMediaScroll() {
    const scroller = expandedMediaScrollerRef.current;

    if (!scroller) {
      return;
    }

    const nextIndex = Math.round(scroller.scrollLeft / Math.max(scroller.clientWidth, 1));

    setExpandedMediaIndex(Math.min(Math.max(nextIndex, 0), postMediaItems.length - 1));
  }

  function handleBackToExplore() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/explore");
  }

  async function handleSaveToBoard(board: AppBoard) {
    if (!post) {
      return;
    }

    setSaveStatus("saving");
    setSaveMessage("");

    try {
      await savePostToBoard(board.id, post.id, post.imageUrl ?? undefined);
      setBoards((current) =>
        current.map((item) =>
          item.id === board.id
            ? {
                ...item,
                coverImageUrl: post.imageUrl && item.coverImageUrl === "/hawaii-reference-map.png" ? post.imageUrl : item.coverImageUrl,
                previewImageUrls: post.imageUrl ? Array.from(new Set([post.imageUrl, ...item.previewImageUrls])).slice(0, 3) : item.previewImageUrls,
                postIds: Array.from(new Set([...item.postIds, post.id])),
              }
            : item,
        ),
      );
      writeActionBanner({
        href: `/posts/${post.id}`,
        imageUrl: post.imageUrl,
        mediaType: post.mediaTypes[0],
        message: `Saved to ${board.title}`,
        title: post.title,
        type: "post-saved",
      });
      router.push("/explore");
    } catch (error) {
      setSaveMessage(formatError(error));
    } finally {
      setSaveStatus("ready");
    }
  }

  async function handleCreateAndSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accountId || !post || !newBoardTitle.trim()) {
      return;
    }

    setSaveStatus("saving");
    setSaveMessage("");

    try {
      const board = await createAppBoard({
        accountId,
        coverImageUrl: post.imageUrl ?? undefined,
        subtitle: newBoardSubtitle,
        title: newBoardTitle,
      });

      await savePostToBoard(board.id, post.id, post.imageUrl ?? undefined);
      const savedBoard = { ...board, previewImageUrls: post.imageUrl ? [post.imageUrl] : [], postIds: [post.id] };
      setBoards((current) => [...current, savedBoard]);
      setNewBoardTitle("");
      setNewBoardSubtitle("");
      setNewBoardOpen(false);
      writeActionBanner({
        href: `/posts/${post.id}`,
        imageUrl: post.imageUrl,
        mediaType: post.mediaTypes[0],
        message: `Saved to ${board.title}`,
        title: post.title,
        type: "post-saved",
      });
      router.push("/explore");
    } catch (error) {
      setSaveMessage(formatError(error));
    } finally {
      setSaveStatus("ready");
    }
  }

  async function handleCreateComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accountId || !post || !commentDraft.trim()) {
      return;
    }

    setCommentStatus("saving");
    setCommentMessage("");

    try {
      const createdComment = await createPostComment({
        accountId,
        body: commentBodyWithMention(commentDraft, commentMentionTarget),
        postId: post.id,
        replyToCommentId: replyTarget?.id ?? null,
      });

      setComments((current) => [createdComment, ...current]);
      setCommentDraft("");
      setReplyTarget(null);
    } catch (error) {
      setCommentMessage(formatError(error));
    } finally {
      setCommentStatus("idle");
    }
  }

  async function handleDeletePost() {
    if (!accountId || !post || accountId !== post.accountId) {
      return;
    }

    const confirmed = window.confirm(`Delete "${post.title}"?`);

    if (!confirmed) {
      return;
    }

    try {
      await deleteAppPost(post.id, accountId);
      router.push("/accounts");
    } catch (error) {
      setCommentMessage(formatError(error));
    }
  }

  async function handleToggleFollowAuthor() {
    if (!accountId || !post || accountId === post.accountId || followStatus === "saving") {
      return;
    }

    const nextFollowState = !isFollowingAuthor;

    setFollowStatus("saving");
    setIsFollowingAuthor(nextFollowState);

    try {
      await setAccountFollow(accountId, post.accountId, nextFollowState);
    } catch (error) {
      setIsFollowingAuthor(!nextFollowState);
      setCommentMessage(formatError(error));
    } finally {
      setFollowStatus("ready");
    }
  }

  function renderComment(comment: AppPostComment, isReply = false) {
    const replies = repliesByCommentId.get(comment.id) ?? [];

    return (
      <div className={isReply ? "ml-11 border-l border-ink/8 pl-3" : ""} key={comment.id}>
        <article className="flex gap-3">
          <Link
            aria-label={`Open @${comment.username}`}
            className={`${isReply ? "h-7 w-7" : "h-8 w-8"} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-shell text-ink/45`}
            href={`/accounts/${comment.username}`}
          >
            {comment.profilePhotoUrl ? (
              <img alt="" className="h-full w-full object-cover" src={comment.profilePhotoUrl} />
            ) : (
              <UserRound aria-hidden="true" size={isReply ? 15 : 17} />
            )}
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <Link className="text-sm font-black text-ink" href={`/accounts/${comment.username}`}>
                {comment.username}
              </Link>
              <span className="text-xs font-bold text-ink/38">{formatCommentTime(comment.createdAt)}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold leading-relaxed text-ink/68">{comment.body}</p>
            {accountId && accountId !== comment.accountId ? (
              <button
                className="mt-2 text-xs font-black text-ink/46"
                onClick={() => {
                  setReplyTarget(comment);
                  setCommentMessage("");
                  setCommentDraft((current) => {
                    const mention = `@${comment.username} `;
                    const trimmedDraft = current.trim();

                    if (!trimmedDraft || /^@\S+\s*$/.test(current)) {
                      return mention;
                    }

                    return current.toLowerCase().startsWith(mention.trim().toLowerCase()) ? current : `${mention}${current}`;
                  });
                }}
                type="button"
              >
                Reply
              </button>
            ) : null}
          </div>
        </article>
        {replies.length ? <div className="mt-3 space-y-3">{replies.map((reply) => renderComment(reply, true))}</div> : null}
      </div>
    );
  }

  return (
    <MobileFrame>
      <article className="h-full overflow-y-auto bg-[#f8f5ef] pb-[6.25rem]">
        <section className={`relative overflow-hidden ${postMediaItems.length ? "h-[338px] bg-ink" : "h-[72px] bg-white"}`}>
          {postMediaItems.length ? (
            <>
              <div
                className="no-scrollbar flex h-full touch-pan-x snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth"
                data-post-media-carousel
                onScroll={handleMediaScroll}
                ref={mediaScrollerRef}
              >
                {postMediaItems.map((item, index) => (
                  item.mediaType === "video" ? (
                    <video
                      aria-label={index === 0 ? post.title : `${post.title} media ${index + 1}`}
                      autoPlay={activePhotoIndex === index}
                      className="h-full w-full shrink-0 snap-center object-cover"
                      controls
                      data-media-index={index}
                      data-post-detail-media
                      key={`${item.url}-${index}`}
                      loop
                      muted
                      playsInline
                      preload={activePhotoIndex === index ? "auto" : "metadata"}
                      src={item.url}
                    />
                  ) : (
                    <PostMediaPreview
                      alt={index === 0 ? post.title : `${post.title} media ${index + 1}`}
                      className="h-full w-full shrink-0 snap-center object-cover"
                      key={`${item.url}-${index}`}
                      mediaType={item.mediaType}
                      src={item.url}
                    />
                  )
                ))}
              </div>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/12 via-transparent to-ink/42" />
              <button
                aria-label="View media full size"
                className="absolute bottom-6 left-5 flex h-10 w-10 items-center justify-center rounded-full bg-ink/36 text-white shadow-lift backdrop-blur"
                onClick={() => setExpandedMediaIndex(activePhotoIndex)}
                type="button"
              >
                <Expand aria-hidden="true" size={17} />
              </button>
            </>
          ) : (
            <div className="h-full bg-white" />
          )}
          <button
            aria-label="Back to Explore"
            className={`absolute left-5 top-[calc(var(--safe-area-top)+1rem)] flex h-11 w-11 items-center justify-center rounded-full shadow-lift backdrop-blur ${
              postMediaItems.length ? "bg-ink/42 text-white" : "bg-white/94 text-ink"
            }`}
            onClick={handleBackToExplore}
            type="button"
          >
            <ArrowLeft aria-hidden="true" size={20} />
          </button>
          {postMediaUrls.length > 1 ? (
            <div className="absolute bottom-6 right-5 rounded-full bg-ink/36 px-4 py-2 text-xs font-black text-white shadow-lift backdrop-blur">
              {activePhotoIndex + 1} / {postMediaUrls.length}
            </div>
          ) : null}
          {postMediaUrls.length > 1 ? (
            <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 gap-1.5">
              {postMediaUrls.map((url, index) => (
                <button
                  aria-label={`Show media ${index + 1}`}
                  className={`h-2 rounded-full transition-all ${activePhotoIndex === index ? "w-5 bg-white" : "w-2 bg-white/54"}`}
                  key={`${url}-dot`}
                  onClick={() => showPhotoAt(index)}
                  type="button"
                />
              ))}
            </div>
          ) : null}
        </section>

        <div className={`rounded-t-[18px] bg-white px-5 pb-8 shadow-[0_-10px_24px_rgba(24,35,31,0.08)] ${postMediaItems.length ? "pt-8" : "pt-4"}`}>
          <section className="mb-5 flex items-center justify-between gap-3">
            <Link className="flex min-w-0 items-center gap-3" href={`/accounts/${post.username}`}>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-shell text-ink/45">
                {post.profilePhotoUrl ? <img alt="" className="h-full w-full object-cover" src={post.profilePhotoUrl} /> : <UserRound aria-hidden="true" size={20} />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-normal text-ink/64">
                  Shared by <strong className="font-black text-ink">{post.username}</strong>
                </span>
                <span className="block text-xs font-bold text-ink/44">{post.dateLabel}</span>
              </span>
            </Link>
            {accountId === post.accountId ? (
              <button
                aria-label="Delete post"
                className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-black text-coral"
                onClick={() => void handleDeletePost()}
                type="button"
              >
                <Trash2 aria-hidden="true" size={15} />
                Delete
              </button>
            ) : (
              <button
                className={`h-9 shrink-0 rounded-full px-4 text-xs font-black transition disabled:opacity-60 ${
                  isFollowingAuthor ? "border border-ink/10 bg-white text-ink" : "bg-ink text-white shadow-lift"
                }`}
                disabled={followStatus === "saving"}
                onClick={() => void handleToggleFollowAuthor()}
                type="button"
              >
                {isFollowingAuthor ? "Following" : "Follow"}
              </button>
            )}
          </section>

          <section>
            <h1 className="text-[26px] font-black leading-tight text-ink">{post.title}</h1>
            <p className="mt-3 whitespace-pre-wrap text-[15px] font-normal leading-relaxed text-ink">{post.caption}</p>
            <div className="mt-3 flex flex-nowrap items-center gap-2 text-xs font-semibold text-ink/56">
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <MapPin aria-hidden="true" className="shrink-0" size={13} />
                <span className="truncate">{post.location}</span>
              </span>
              <span className="h-1 w-1 shrink-0 rounded-full bg-ink/28" />
              <span className="flex shrink-0 items-center gap-1.5">
                <Calendar aria-hidden="true" size={13} />
                {post.dateLabel}
              </span>
            </div>
            {post.tags.length ? (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {post.tags.map((tag) => (
                  <span className="shrink-0 rounded-full bg-[#f1efeb] px-3.5 py-2 text-xs font-black text-ink/72" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </section>

          {postMediaItems.length > 1 ? (
            <section className="mt-5 border-t border-ink/8 pt-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-black text-ink">More from this experience</h2>
                <button
                  className="shrink-0 text-sm font-black text-blue-600"
                  onClick={() => setExpandedMediaIndex(0)}
                  type="button"
                >
                  See all ({postMediaItems.length})
                </button>
              </div>
              <div className="no-scrollbar mt-4 flex gap-3 overflow-x-auto border-b border-ink/8 pb-5">
                {postMediaItems.map((item, index) => (
                  <button
                    aria-label={`Open media ${index + 1}`}
                    className="relative h-[92px] w-[132px] shrink-0 overflow-hidden rounded-[15px] bg-ink/8 shadow-[0_8px_18px_rgba(24,35,31,0.08)]"
                    key={`${item.url}-experience-strip`}
                    onClick={() => setExpandedMediaIndex(index)}
                    type="button"
                  >
                    <PostMediaPreview alt="" className="h-full w-full object-cover" mediaType={item.mediaType} src={item.url} />
                    {item.mediaType === "video" ? (
                      <span className="absolute bottom-2 left-2 grid h-9 w-9 place-items-center rounded-full bg-ink/56 text-white shadow-lift backdrop-blur">
                        <Play aria-hidden="true" fill="currentColor" size={17} />
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-5">
            <h2 className="text-[22px] font-black text-ink">Location</h2>
            <div className="mt-3 overflow-hidden rounded-[18px] border border-ink/10 bg-white shadow-[0_8px_22px_rgba(24,35,31,0.05)]">
              <div className="relative overflow-hidden">
                <DynamicMapboxMap
                  className="h-[150px] w-full"
                  experiences={[mapExperience]}
                  mapTarget={{ center: post.coordinates, zoom: 12.8 }}
                  selectedSlug={mapExperience.slug}
                  zoom={10.4}
                />
                <button
                  aria-label="Expand map"
                  className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/92 text-ink shadow-lift"
                  onClick={() => setMapExpanded(true)}
                  type="button"
                >
                  <Expand aria-hidden="true" size={17} />
                </button>
              </div>
            </div>
          </section>

          <section className="mt-5 rounded-[18px] border border-ink/10 bg-white p-4 shadow-[0_8px_22px_rgba(24,35,31,0.05)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-black text-ink">Comments ({comments.length})</h2>
              <ChevronDown aria-hidden="true" className="text-ink/44" size={21} />
            </div>

            <div className="mt-4 space-y-4">
              {commentStatus === "loading" ? (
                <p className="py-4 text-center text-sm font-bold text-ink/42">Loading comments...</p>
              ) : comments.length ? (
                visibleCommentRoots.map((comment) => renderComment(comment))
              ) : (
                <p className="py-2 text-center text-sm font-bold text-ink/42">No comments yet.</p>
              )}
            </div>

            {accountId ? (
              <div className="mt-5">
                {replyTarget ? (
                  <div className="mb-2 flex items-center justify-between gap-3 rounded-2xl bg-shell px-4 py-2">
                    <p className="min-w-0 truncate text-xs font-bold text-ink/54">
                      Replying to <span className="font-black text-ink">@{replyTarget.username}</span>
                    </p>
                    <button
                      className="shrink-0 text-xs font-black text-coral"
                      onClick={() => {
                        const mention = `@${replyTarget.username}`;

                        setReplyTarget(null);
                        setCommentDraft((current) => (current.trim().toLowerCase() === mention.toLowerCase() ? "" : current));
                      }}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}
                <form className="flex items-end gap-2 rounded-full border border-ink/8 bg-white p-2 shadow-inner" onSubmit={handleCreateComment}>
                  <label className="block flex-1">
                    <span className="sr-only">Add a public comment</span>
                    <textarea
                      className="max-h-24 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 text-sm font-semibold leading-relaxed text-ink outline-none placeholder:text-ink/34"
                      maxLength={500}
                      onChange={(event) => setCommentDraft(event.target.value)}
                      placeholder={commentMentionTarget ? `Reply to @${commentMentionTarget}` : "Add a public comment"}
                      value={commentDraft}
                    />
                  </label>
                  <button
                    aria-label="Post comment"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-white shadow-lift disabled:opacity-35"
                    disabled={commentStatus === "saving" || !commentDraft.trim() || resolvedCommentBody.length > 500}
                    type="submit"
                  >
                    <Send aria-hidden="true" size={16} />
                  </button>
                </form>
              </div>
            ) : (
              <Link className="mt-4 flex h-12 items-center justify-center rounded-full bg-shell px-5 text-sm font-black text-ink" href="/accounts">
                Log in to comment
              </Link>
            )}

            {commentMessage ? <p className="mt-4 rounded-2xl bg-coral/10 px-4 py-3 text-sm font-bold text-coral">{commentMessage}</p> : null}
          </section>

        </div>
      </article>

      {expandedMediaIndex !== null && postMediaItems[expandedMediaIndex] ? (
        <div className="absolute inset-0 z-50 flex flex-col bg-ink">
          <div className="safe-top-bar flex items-center justify-between px-5 pb-3">
            <button
              aria-label="Close full size media"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur"
              onClick={() => setExpandedMediaIndex(null)}
              type="button"
            >
              <X aria-hidden="true" size={20} />
            </button>
            {postMediaItems.length > 1 ? (
              <span className="rounded-full bg-white/12 px-3 py-1.5 text-xs font-black text-white backdrop-blur">
                {expandedMediaIndex + 1} / {postMediaItems.length}
              </span>
            ) : null}
          </div>
          <div
            className="no-scrollbar flex min-h-0 flex-1 touch-pan-x snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth"
            data-post-media-carousel
            onScroll={handleExpandedMediaScroll}
            ref={expandedMediaScrollerRef}
          >
            {postMediaItems.map((item, index) => (
              <div className="flex h-full w-full shrink-0 snap-center items-center justify-center" key={`${item.url}-expanded-${index}`}>
                {item.mediaType === "video" ? (
                  <video
                    aria-label={index === 0 ? `${post.title} full size media` : `${post.title} full size media ${index + 1}`}
                    className="max-h-full max-w-full object-contain"
                    controls
                    playsInline
                    preload="metadata"
                    src={item.url}
                  />
                ) : (
                  <img
                    alt={index === 0 ? `${post.title} full size media` : `${post.title} full size media ${index + 1}`}
                    className="max-h-full max-w-full object-contain"
                    src={item.url}
                  />
                )}
              </div>
            ))}
          </div>
          {postMediaItems.length > 1 ? (
            <div className="flex justify-center gap-1.5 px-5 pb-4">
              {postMediaItems.map((item, index) => (
                <button
                  aria-label={`Show full size media ${index + 1}`}
                  className={`h-2 rounded-full transition-all ${expandedMediaIndex === index ? "w-5 bg-white" : "w-2 bg-white/42"}`}
                  key={`${item.url}-expanded-dot-${index}`}
                  onClick={() => setExpandedMediaIndex(index)}
                  type="button"
                />
              ))}
            </div>
          ) : null}
          <div className="h-[calc(var(--safe-area-bottom)+1rem)]" />
        </div>
      ) : null}

      {mapExpanded ? (
        <div className="absolute inset-0 z-50 bg-ink">
          <DynamicMapboxMap
            className="h-full w-full"
            experiences={[mapExperience]}
            mapTarget={{ center: post.coordinates, zoom: 15 }}
            selectedSlug={mapExperience.slug}
            zoom={14.2}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-ink/52 to-transparent px-5 pb-14 pt-[calc(var(--safe-area-top)+1rem)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 rounded-[18px] bg-ink/50 px-4 py-3 text-white shadow-lift backdrop-blur">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/62">Location</p>
                <p className="mt-1 line-clamp-2 text-sm font-black leading-tight">{post.location}</p>
              </div>
            </div>
          </div>
          <button
            aria-label="Close expanded map"
            className="absolute right-5 top-[calc(var(--safe-area-top)+1rem)] flex h-11 w-11 items-center justify-center rounded-full bg-ink/52 text-white shadow-lift backdrop-blur"
            onClick={() => setMapExpanded(false)}
            type="button"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>
      ) : null}

      <div className="absolute inset-x-5 bottom-[calc(var(--safe-area-bottom)+1.1rem)] z-40 flex h-16 items-center overflow-hidden rounded-[9px] bg-moss text-white shadow-lift">
        <button className="flex h-full w-full items-center justify-center gap-2 text-sm font-black" onClick={() => setSaveOpen(true)} type="button">
          <Bookmark aria-hidden="true" fill={isSaved ? "currentColor" : "none"} size={18} />
          Save to Board
        </button>
      </div>

      {saveOpen ? (
        <div className="safe-modal-bottom absolute inset-x-0 top-0 z-50 flex h-full items-end bg-ink/28 backdrop-blur-sm">
          <section className="max-h-[82%] w-full overflow-y-auto rounded-t-[30px] bg-white p-5 shadow-soft">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-coral">Save post</p>
                <h2 className="text-2xl font-black text-ink">Choose a board</h2>
              </div>
              <button
                aria-label="Close save menu"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-shell text-ink"
                onClick={() => setSaveOpen(false)}
                type="button"
              >
                <X aria-hidden="true" size={19} />
              </button>
            </div>

            {saveMessage ? <p className="mb-4 rounded-2xl bg-moss/10 px-4 py-3 text-sm font-bold text-moss">{saveMessage}</p> : null}

            <div className="space-y-3">
              {boards.map((board) => {
                const boardHasPost = board.postIds.includes(post.id);

                return (
                  <button
                    className="flex w-full items-center gap-3 rounded-[22px] border border-ink/8 bg-shell p-3 text-left disabled:opacity-60"
                    disabled={saveStatus === "saving" || boardHasPost}
                    key={board.id}
                    onClick={() => handleSaveToBoard(board)}
                    type="button"
                  >
                    <img alt="" className="h-14 w-14 rounded-2xl object-cover" src={board.coverImageUrl} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-ink">{board.title}</span>
                      <span className="block truncate text-xs font-bold text-ink/50">
                        {board.postIds.length} {board.postIds.length === 1 ? "post" : "posts"}
                      </span>
                    </span>
                    {boardHasPost ? <Check aria-hidden="true" className="text-moss" size={20} /> : <Plus aria-hidden="true" className="text-ink/42" size={20} />}
                  </button>
                );
              })}
            </div>

            {!boards.length && !newBoardOpen ? (
              <p className="rounded-[24px] bg-shell px-4 py-5 text-center text-sm font-semibold leading-relaxed text-ink/58">
                You do not have any boards yet. Create one below and this post will be saved there.
              </p>
            ) : null}

            {newBoardOpen ? (
              <form className="mt-4 rounded-[24px] bg-shell p-4" onSubmit={handleCreateAndSave}>
                <label className="mb-3 block">
                  <span className="mb-1 block text-sm font-bold text-ink/70">Board name</span>
                  <input
                    className="h-12 w-full rounded-2xl border border-ink/10 bg-white px-4 text-base font-bold text-ink outline-none focus:border-coral"
                    onChange={(event) => setNewBoardTitle(event.target.value)}
                    placeholder="Weekend saves"
                    value={newBoardTitle}
                  />
                </label>
                <label className="mb-4 block">
                  <span className="mb-1 block text-sm font-bold text-ink/70">Description</span>
                  <textarea
                    className="min-h-20 w-full resize-none rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm font-semibold leading-relaxed text-ink outline-none focus:border-coral"
                    onChange={(event) => setNewBoardSubtitle(event.target.value)}
                    placeholder="Optional note"
                    value={newBoardSubtitle}
                  />
                </label>
                <button
                  className="flex w-full items-center justify-center rounded-full bg-ink px-5 py-4 text-sm font-black text-white shadow-lift disabled:opacity-50"
                  disabled={saveStatus === "saving" || !newBoardTitle.trim()}
                  type="submit"
                >
                  {saveStatus === "saving" ? "Saving..." : "Create and Save"}
                </button>
              </form>
            ) : (
              <button
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-ink px-5 py-4 text-sm font-black text-white shadow-lift"
                onClick={() => setNewBoardOpen(true)}
                type="button"
              >
                <Plus aria-hidden="true" size={18} />
                New Board
              </button>
            )}
          </section>
        </div>
      ) : null}
    </MobileFrame>
  );
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error("Request timed out.")), timeoutMs);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeoutId));
  });
}

function commentBodyWithMention(body: string, username: string | null) {
  const trimmedBody = body.trim();

  if (!username) {
    return trimmedBody;
  }

  const mention = `@${username}`;

  if (trimmedBody.toLowerCase().startsWith(mention.toLowerCase())) {
    return trimmedBody;
  }

  return `${mention} ${trimmedBody}`;
}

function formatCommentTime(value: string) {
  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return "";
  }

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (seconds < 60) {
    return "Just now";
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `${days}d ago`;
  }

  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

function readCachedPost(postId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const detailPost = readCachedPostFromKey(`${postDetailCachePrefix}-${postId}`, postId);

  if (detailPost) {
    return detailPost;
  }

  const explorePost = readCachedPostFromKey(appPostsCacheKey, postId);

  if (explorePost) {
    return explorePost;
  }

  try {
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index);

      if (key?.startsWith(profilePostsCachePrefix)) {
        const cachedPost = readCachedPostFromKey(key, postId);

        if (cachedPost) {
          return cachedPost;
        }
      }
    }
  } catch {
    return null;
  }

  return null;
}

function readCachedPostFromKey(key: string, postId: string) {
  try {
    const cached = window.sessionStorage.getItem(key);

    if (!cached) {
      return null;
    }

    const parsed = JSON.parse(cached) as AppPost | AppPost[];
    const post = Array.isArray(parsed) ? parsed.find((item) => item.id === postId) : parsed.id === postId ? parsed : null;

    return post ?? null;
  } catch {
    return null;
  }
}

function writeCachedPost(post: AppPost) {
  try {
    window.sessionStorage.setItem(`${postDetailCachePrefix}-${post.id}`, JSON.stringify(post));
  } catch {
    // Detail pages still load directly if session storage is unavailable.
  }
}

function writeCachedAppPosts(posts: AppPost[]) {
  try {
    window.sessionStorage.setItem(appPostsCacheKey, JSON.stringify(posts));
  } catch {
    // Explore can still refresh from Supabase if session storage is unavailable.
  }
}
