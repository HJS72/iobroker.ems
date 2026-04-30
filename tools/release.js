#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

function exec(cmd, opts = {}) {
    return execSync(cmd, { stdio: 'pipe', encoding: 'utf8', ...opts }).trim();
}

function parseGithubOwnerRepo(url) {
    try {
        if (url.startsWith('git@')) {
            const m = url.match(/^git@[^:]+:([^/]+)\/([^/]+)(\.git)?$/);
            if (m) return { owner: m[1], repo: m[2].replace(/\.git$/, '') };
        } else {
            const u = new URL(url);
            if (u.hostname.endsWith('github.com')) {
                const parts = u.pathname.replace(/^\//, '').replace(/\.git$/, '').split('/');
                if (parts.length >= 2) return { owner: parts[0], repo: parts[1] };
            }
        }
    } catch (e) {}
    return null;
}

function bumpPatch(version) {
    const parts = version.split('.');
    const last = parseInt(parts.pop(), 10);
    if (isNaN(last)) throw new Error('Cannot bump version');
    parts.push(String(last + 1));
    return parts.join('.');
}

async function main() {
    const repoRoot = path.resolve(__dirname, '..');
    process.chdir(repoRoot);

    const origin = exec('git remote get-url origin');
    const parsed = parseGithubOwnerRepo(origin);
    if (!parsed) {
        console.error('Could not parse origin remote URL:', origin);
        process.exit(1);
    }
    const pkgPath = path.join(repoRoot, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const current = pkg.version;
    const argVersion = process.argv[2];
    const newVersion = argVersion || bumpPatch(current);
    const tag = `v${newVersion}`;

    console.log(`Releasing ${parsed.owner}/${parsed.repo} — bump ${current} → ${newVersion}`);

    // update package.json
    pkg.version = newVersion;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

    // commit
    exec(`git add package.json`);
    exec(`git commit -m "chore(release): bump version to ${newVersion}"`);

    // tag
    exec(`git tag -a ${tag} -m "Release ${tag}"`);

    // push
    exec(`git push origin HEAD`);
    exec(`git push origin ${tag}`);

    // Optionally create a GitHub release if token present
    const token = process.env.GITHUB_TOKEN;
    if (token) {
        const apiUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/releases`;
        const body = {
            tag_name: tag,
            name: tag,
            body: `Release ${tag}`,
            draft: false,
            prerelease: false
        };
        console.log('Creating GitHub release via API...');
        const resp = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `token ${token}`,
                'User-Agent': 'ems-release-script',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        if (!resp.ok) {
            const txt = await resp.text();
            console.error('GitHub release creation failed:', resp.status, txt);
        } else {
            console.log('GitHub release created.');
        }
    } else {
        console.log('No GITHUB_TOKEN set — skipped creating GitHub Release object (tag pushed).');
    }

    console.log('Release flow finished.');
}

main().catch(err => { console.error(err); process.exit(1); });
