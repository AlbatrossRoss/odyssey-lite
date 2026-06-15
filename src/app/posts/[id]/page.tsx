"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Bookmark, Calendar, Check, MapPin, MessageCircle, Plus, Send, UserRound, X } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { MapboxMap } from "@/components/MapboxMap";
import { MobileFrame } from "@/components/MobileFrame";
import { PostMediaPreview } from "@/components/PostMediaPreview";
import { fetchAppPostById, type AppPost } from "@/lib/posts";
import { createPostComment, fetchPostComments, type AppPostComment } from "@/lib/postComments";
import type { Experience } from "@/lib/data";
import { createAppBoard, fetchBoardsByAccount, savePostToBoard, type AppBoard } from "@/lib/boards";
import { fetchAccountById, readAccountSessionId } from "@/lib/accounts";
import { writeActionBanner } from "@/lib/actionBanner";

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
  const [viewerUsername, setViewerUsername] = useState<string | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const mediaScrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    const viewerId = readAccountSessionId();

    setAccountId(viewerId);

    fetchAppPostById(params.id)
      .then((nextPost) => {
        if (active) {
          setPost(nextPost);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setLoading(false);
        }
      });

    if (viewerId) {
      fetchAccountById(viewerId)
        .then((account) => {
          if (active) {
            setViewerUsername(account?.username ?? null);
          }
        })
        .catch(() => {
          if (active) {
            setViewerUsername(null);
          }
        });
    } else {
      setViewerUsername(null);
    }

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
  const commentMentionTarget = useMemo(() => {
    if (!post || !accountId) {
      return null;
    }

    if (accountId !== post.accountId) {
      return post.username;
    }

    const latestOtherComment = comments.find((comment) => comment.accountId !== accountId);

    if (!latestOtherComment || latestOtherComment.username === viewerUsername) {
      return null;
    }

    return latestOtherComment.username;
  }, [accountId, comments, post, viewerUsername]);
  const resolvedCommentBody = commentBodyWithMention(commentDraft, commentMentionTarget);

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
  const postMediaUrls = post.mediaUrls.length ? post.mediaUrls : post.imageUrl ? [post.imageUrl] : [];
  const postMediaItems = postMediaUrls.map((url, index) => ({
    mediaType: post.mediaTypes[index] ?? "image",
    url,
  }));

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

    setActivePhotoIndex(Math.round(scroller.scrollLeft / Math.max(scroller.clientWidth, 1)));
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
      });

      setComments((current) => [createdComment, ...current]);
      setCommentDraft("");
    } catch (error) {
      setCommentMessage(formatError(error));
    } finally {
      setCommentStatus("idle");
    }
  }

  return (
    <MobileFrame>
      <article className="safe-page-bottom h-full overflow-y-auto bg-shell">
        <div className={`relative h-[430px] overflow-hidden ${postMediaItems.length ? "bg-ink" : "bg-white"}`}>
          {postMediaItems.length ? (
            <>
              <div className="no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto" onScroll={handleMediaScroll} ref={mediaScrollerRef}>
                {postMediaItems.map((item, index) => (
                  <PostMediaPreview
                    alt={index === 0 ? post.title : `${post.title} media ${index + 1}`}
                    className="h-full w-full shrink-0 snap-center object-cover"
                    controls={item.mediaType === "video"}
                    key={`${item.url}-${index}`}
                    mediaType={item.mediaType}
                    muted={item.mediaType !== "video"}
                    src={item.url}
                  />
                ))}
              </div>
              <div className="absolute inset-0 bg-gradient-to-b from-ink/34 via-transparent to-ink/74" />
            </>
          ) : null}
          {postMediaUrls.length > 1 ? (
            <div className="absolute right-4 top-[calc(var(--safe-area-top)+1.25rem)] rounded-full bg-ink/62 px-3 py-1 text-xs font-black text-white backdrop-blur">
              {postMediaUrls.length} items
            </div>
          ) : null}
          <button
            aria-label="Back to Explore"
            className="safe-top-control absolute left-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/88 text-ink shadow-lift backdrop-blur"
            onClick={handleBackToExplore}
            type="button"
          >
            <ArrowLeft aria-hidden="true" size={20} />
          </button>
          <div className={`absolute bottom-6 left-5 right-5 ${postMediaItems.length ? "text-white" : "text-ink"}`}>
            <Link className="mb-4 flex items-center gap-3" href={`/accounts/${post.username}`}>
              <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-shell text-ink shadow-lift">
                {post.profilePhotoUrl ? (
                  <img alt="" className="h-full w-full object-cover" src={post.profilePhotoUrl} />
                ) : (
                  <UserRound aria-hidden="true" size={22} />
                )}
              </span>
              <span>
                <span className="block text-sm font-black">@{post.username}</span>
                <span className={`block text-xs font-semibold capitalize ${postMediaItems.length ? "text-white/72" : "text-ink/52"}`}>{post.type}</span>
              </span>
            </Link>
            <h1 className="text-4xl font-black leading-none">{post.title}</h1>
            {!postMediaItems.length ? <p className="mt-4 line-clamp-4 text-base font-semibold leading-relaxed text-ink/62">{post.caption}</p> : null}
          </div>
        </div>

        <div className="-mt-5 space-y-4 rounded-t-[34px] bg-shell px-5 pb-8 pt-5">
          {postMediaUrls.length > 1 ? (
            <section className="rounded-[24px] bg-white p-2 shadow-soft">
              <div className="grid grid-cols-4 gap-2">
                {postMediaItems.slice(0, 8).map((item, index) => (
                  <button
                    aria-label={`Show media ${index + 1}`}
                    className={`relative aspect-square overflow-hidden rounded-[16px] bg-shell ring-offset-2 ring-offset-white ${
                      activePhotoIndex === index ? "ring-2 ring-coral" : "ring-1 ring-ink/8"
                    }`}
                    key={`${item.url}-thumb-${index}`}
                    onClick={() => showPhotoAt(index)}
                    type="button"
                  >
                    <PostMediaPreview className="h-full w-full object-cover" mediaType={item.mediaType} src={item.url} />
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-[28px] bg-white p-4 shadow-soft">
            <p className="text-[15px] leading-relaxed text-ink/74">{post.caption}</p>
            <div className="mt-4 grid gap-2">
              <p className="flex items-center gap-2 text-sm font-bold text-ink/58">
                <MapPin aria-hidden="true" className="text-coral" size={17} />
                {post.location}
              </p>
              <p className="flex items-center gap-2 text-sm font-bold text-ink/58">
                <Calendar aria-hidden="true" className="text-coral" size={17} />
                {post.dateLabel}
              </p>
            </div>
            {post.tags.length ? (
              <div className="mt-5 flex flex-wrap gap-2 border-t border-ink/8 pt-4">
                {post.tags.map((tag) => (
                  <span className="rounded-full bg-shell px-3 py-2 text-xs font-black text-ink/62" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
            <button
              className={`mt-5 flex w-full items-center justify-center gap-2 rounded-full px-5 py-4 text-sm font-black shadow-lift ${
                isSaved ? "bg-ink text-white" : "bg-coral text-white"
              }`}
              onClick={() => setSaveOpen(true)}
              type="button"
            >
              <Bookmark aria-hidden="true" fill={isSaved ? "currentColor" : "none"} size={18} />
              {isSaved ? "Saved to Board" : "Save to Board"}
            </button>
          </section>

          <MapboxMap
            className="h-56 overflow-hidden rounded-[28px] shadow-soft"
            experiences={[mapExperience]}
            mapTarget={{ center: post.coordinates, zoom: 14.2 }}
            selectedSlug={mapExperience.slug}
            zoom={10.4}
          />

          <section className="rounded-[28px] bg-white p-4 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-coral">Comments</p>
                <h2 className="mt-1 text-xl font-black text-ink">{comments.length} public {comments.length === 1 ? "comment" : "comments"}</h2>
              </div>
              <MessageCircle aria-hidden="true" className="text-ink/34" size={24} />
            </div>

            {accountId ? (
              <form className="mt-4" onSubmit={handleCreateComment}>
                <label className="block">
                  <span className="sr-only">Add a public comment</span>
                  <textarea
                    className="min-h-24 w-full resize-none rounded-[22px] bg-shell px-4 py-3 text-sm font-semibold leading-relaxed text-ink outline-none ring-1 ring-ink/8 placeholder:text-ink/34 focus:ring-coral"
                    maxLength={500}
                    onChange={(event) => setCommentDraft(event.target.value)}
                    placeholder={commentMentionTarget ? `Reply to @${commentMentionTarget}` : "Add a public comment"}
                    value={commentDraft}
                  />
                </label>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-bold text-ink/38">{resolvedCommentBody.length}/500</p>
                  <button
                    className="flex h-11 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-black text-white shadow-lift disabled:opacity-45"
                    disabled={commentStatus === "saving" || !commentDraft.trim() || resolvedCommentBody.length > 500}
                    type="submit"
                  >
                    <Send aria-hidden="true" size={16} />
                    Post
                  </button>
                </div>
              </form>
            ) : (
              <Link className="mt-4 flex h-12 items-center justify-center rounded-full bg-shell px-5 text-sm font-black text-ink" href="/accounts">
                Log in to comment
              </Link>
            )}

            {commentMessage ? <p className="mt-4 rounded-2xl bg-coral/10 px-4 py-3 text-sm font-bold text-coral">{commentMessage}</p> : null}

            <div className="mt-5 space-y-4 border-t border-ink/8 pt-4">
              {commentStatus === "loading" ? (
                <p className="py-4 text-center text-sm font-bold text-ink/42">Loading comments...</p>
              ) : comments.length ? (
                comments.map((comment) => (
                  <article className="flex gap-3" key={comment.id}>
                    <Link
                      aria-label={`Open @${comment.username}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-shell text-ink/45"
                      href={`/accounts/${comment.username}`}
                    >
                      {comment.profilePhotoUrl ? (
                        <img alt="" className="h-full w-full object-cover" src={comment.profilePhotoUrl} />
                      ) : (
                        <UserRound aria-hidden="true" size={18} />
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <Link className="text-sm font-black text-ink" href={`/accounts/${comment.username}`}>
                          @{comment.username}
                        </Link>
                        <span className="text-xs font-bold text-ink/38">{formatCommentTime(comment.createdAt)}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold leading-relaxed text-ink/68">{comment.body}</p>
                    </div>
                  </article>
                ))
              ) : (
                <p className="py-4 text-center text-sm font-bold text-ink/42">No comments yet.</p>
              )}
            </div>
          </section>
        </div>
      </article>

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
      <BottomNav />
    </MobileFrame>
  );
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
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
