import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getRepoCoordinates() {
    const owner = process.env.GITHUB_OWNER || process.env.VERCEL_GIT_REPO_OWNER || 'sushant-wayal';
    const repo = process.env.GITHUB_REPO || process.env.VERCEL_GIT_REPO_SLUG || 'auto-youtube-channel';
    const branch = process.env.GITHUB_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || 'main';
    const token = process.env.GITHUB_TOKEN;
    return { owner, repo, branch, token };
}

/**
 * GET /api/fork-sync
 * Checks if the current repo is a fork and whether it is behind the upstream parent repo.
 */
export async function GET() {
    try {
        const { owner, repo, branch, token } = getRepoCoordinates();
        const headers: Record<string, string> = {
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        };
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        // 1. Fetch repository details to inspect fork status and parent info
        const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
            headers,
            cache: 'no-store',
        });

        if (!repoRes.ok) {
            const errText = await repoRes.text().catch(() => '');
            return NextResponse.json({
                ok: false,
                isFork: false,
                error: `GitHub API error fetching repo (${repoRes.status}): ${errText}`,
            });
        }

        const repoData = await repoRes.json();
        const isFork = Boolean(repoData.fork && repoData.parent);

        if (!isFork) {
            return NextResponse.json({
                ok: true,
                isFork: false,
                message: 'Repository is not a fork.',
            });
        }

        const parent = repoData.parent;
        const parentOwner = parent.owner?.login;
        const parentRepo = parent.name;
        const parentFullName = parent.full_name;
        const parentBranch = parent.default_branch || 'main';
        const forkBranch = repoData.default_branch || branch || 'main';

        // 2. Compare fork's branch with upstream parent's branch
        // Comparing base (parentBranch) with head (owner:forkBranch)
        // behind_by tells us how many commits the fork is behind parent
        let compareData: any = null;
        let behindBy = 0;
        let aheadBy = 0;
        let status = 'identical';

        const compareRes1 = await fetch(
            `https://api.github.com/repos/${parentOwner}/${parentRepo}/compare/${parentBranch}...${owner}:${forkBranch}`,
            { headers, cache: 'no-store' }
        );

        if (compareRes1.ok) {
            compareData = await compareRes1.json();
            behindBy = compareData.behind_by ?? 0;
            aheadBy = compareData.ahead_by ?? 0;
            status = compareData.status ?? 'identical';
        } else {
            // Fallback comparison from fork's perspective:
            // base = forkBranch, head = parentOwner:parentBranch
            // In this direction, ahead_by means parent is ahead of fork (i.e. fork is behind)
            const compareRes2 = await fetch(
                `https://api.github.com/repos/${owner}/${repo}/compare/${forkBranch}...${parentOwner}:${parentBranch}`,
                { headers, cache: 'no-store' }
            );
            if (compareRes2.ok) {
                compareData = await compareRes2.json();
                behindBy = compareData.ahead_by ?? 0;
                aheadBy = compareData.behind_by ?? 0;
                status = compareData.status === 'ahead' ? 'behind' : (compareData.status === 'behind' ? 'ahead' : compareData.status);
            }
        }

        const isBehind = behindBy > 0 || status === 'behind';

        return NextResponse.json({
            ok: true,
            isFork: true,
            isBehind,
            behindBy,
            aheadBy,
            status,
            forkRepo: `${owner}/${repo}`,
            forkBranch,
            parentRepo: parentFullName,
            parentBranch,
            compareUrl: compareData?.html_url || `https://github.com/${parentFullName}/compare/${parentBranch}...${owner}:${forkBranch}`,
        });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, isFork: false, error: err.message || String(err) },
            { status: 500 }
        );
    }
}

/**
 * POST /api/fork-sync
 * Syncs the fork branch with the upstream parent using GitHub's merge-upstream API.
 * Merging/fast-forwarding upstream commits onto the fork's main branch triggers
 * a Vercel production redeploy automatically via Vercel's GitHub integration.
 */
export async function POST() {
    try {
        const { owner, repo, branch, token } = getRepoCoordinates();

        if (!token) {
            return NextResponse.json(
                { ok: false, error: 'GITHUB_TOKEN is not configured on the server. Please add it to your environment variables.' },
                { status: 400 }
            );
        }

        const headers: Record<string, string> = {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
        };

        // 1. Verify repository is a fork and resolve target branch
        const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
            headers,
            cache: 'no-store',
        });

        if (!repoRes.ok) {
            const errText = await repoRes.text().catch(() => '');
            return NextResponse.json(
                { ok: false, error: `GitHub error fetching repo (${repoRes.status}): ${errText}` },
                { status: repoRes.status }
            );
        }

        const repoData = await repoRes.json();
        if (!repoData.fork) {
            return NextResponse.json(
                { ok: false, error: 'This repository is not a fork. Upstream sync is only applicable to forked repositories.' },
                { status: 400 }
            );
        }

        const targetBranch = repoData.default_branch || branch || 'main';

        // 2. Call GitHub's merge-upstream API
        const mergeRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/merge-upstream`,
            {
                method: 'POST',
                headers,
                body: JSON.stringify({ branch: targetBranch }),
            }
        );

        const mergeData = await mergeRes.json().catch(() => ({}));

        if (mergeRes.status === 200) {
            return NextResponse.json({
                ok: true,
                message: mergeData.message || 'Successfully synced fork with upstream! Vercel is now redeploying.',
                mergeType: mergeData.merge_type || 'fast-forward',
                baseBranch: targetBranch,
            });
        }

        if (mergeRes.status === 409) {
            return NextResponse.json(
                {
                    ok: false,
                    conflict: true,
                    error: mergeData.message || 'Cannot auto-sync: merge conflict exists between your fork and upstream. Please resolve it on GitHub.',
                },
                { status: 409 }
            );
        }

        return NextResponse.json(
            {
                ok: false,
                error: mergeData.message || `GitHub returned HTTP ${mergeRes.status}`,
            },
            { status: mergeRes.status }
        );
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err.message || String(err) },
            { status: 500 }
        );
    }
}

