# 浏览器插件发布流程

插件在 GitHub 独立仓库 `Kxmrg/pocket-evo-extension` 发布。用户从正式 Release 下载可安装的 ZIP。Evo 主仓库的 `chrome-extension/` 同步相同源码，插件版本标签只打在独立仓库。 [查看历次发布](https://github.com/Kxmrg/pocket-evo-extension/releases)

## 1. 确定版本并推送标签

以下命令使用 Bash。先在独立仓库更新 `main`。以 `1.6.1` 为例，后续版本替换 `VERSION` 即可。若远端已有本次标签，保留它，从第 2 步开始。

```bash
VERSION=1.6.1
git remote get-url origin
git switch main
git pull --ff-only origin main
```

将 `package.json`、`public/manifest.json` 和 `package-lock.json` 的项目版本（顶层及 `packages[""]`）设为同一值。核对差异，在 Node.js 24 环境运行 `npm ci`、`npm test`、`npm run build`，全部成功后提交并创建带注释的标签。标签使用 `X.Y.Z` 格式。

```bash
git add -- package.json package-lock.json public/manifest.json
git diff --cached
git commit -m "升级浏览器插件至 $VERSION"
git tag -a "$VERSION" -m "Pocket Evo site import extension $VERSION"
git push --atomic origin main "refs/tags/$VERSION"
```

## 2. 从已推送的标签构建安装包

在新临时目录检出 GitHub 上的标签并构建。只归档 `dist/` 的内容，让 Chrome 能在解压目录顶层找到 `manifest.json`。以下命令在同一 Bash 会话中运行。

```bash
set -euo pipefail
VERSION=1.6.1
REPO=Kxmrg/pocket-evo-extension
OUT=$(mktemp -d)
ASSET="pocket-evo-extension-$VERSION.zip"
git clone --depth 1 --branch "$VERSION" "https://github.com/$REPO.git" "$OUT/source"
(
  cd "$OUT/source"
  test "$(git rev-parse HEAD)" = "$(git rev-parse "refs/tags/$VERSION^{commit}")"
  npm ci
  npm test
  npm run build
  cd dist
  zip -q -r "$OUT/$ASSET" . -x '*.DS_Store' '__MACOSX/*'
)
unzip -tq "$OUT/$ASSET"
unzip -p "$OUT/$ASSET" manifest.json | node -e 'const fs = require("node:fs"); const manifest = JSON.parse(fs.readFileSync(0, "utf8")); require("node:assert/strict").equal(manifest.version, process.argv[1])' "$VERSION"
shasum -a 256 "$OUT/$ASSET"
```

## 3. 发布 GitHub Release

在 Releases 页选择 **Draft a new release**，选取已有的同名标签，标题填写 `Pocket Evo 站点导入插件 X.Y.Z`。正文写明本版面向用户的改动和安装方法。上传上一步的 `$OUT/$ASSET`，选择正式版并设为 **Latest**，点击 **Publish release**。如果已有同版草稿，继续编辑该草稿。 [打开 Releases](https://github.com/Kxmrg/pocket-evo-extension/releases)

也可以使用已登录且拥有仓库写权限的 GitHub CLI。在 `$OUT/release-notes.md` 写好发布说明后执行：

```bash
gh release create "$VERSION" "$OUT/$ASSET" --repo "$REPO" --verify-tag --latest \
  --title "Pocket Evo 站点导入插件 $VERSION" --notes-file "$OUT/release-notes.md"
```

只有 Git SSH 发布权限时，也可以沿用 1.6.1 的 GitHub Actions 流程。先从已有标签新建临时分支 `release-upload/X.Y.Z-短提交号`，将验证过的 ZIP 放到该分支的 `.release/`。复制示例工作流到 `.github/workflows/`，更新触发分支、标签、完整提交号、ZIP 文件名、SHA-256 和发布说明。推送分支后，在 Actions 中查看该次运行。它会校验标签和安装包，再创建正式 Release。完成第 4 步的下载验收后即可删除临时分支。[查看 1.6.1 工作流示例](https://github.com/Kxmrg/pocket-evo-extension/blob/0d4d6ace91f482b43c04628ea323e3d540f33351/.github/workflows/publish-1.6.1.yml)

安装说明可写为“下载 `pocket-evo-extension-X.Y.Z.zip` 并解压，在 Chrome 132 或更高版本打开 `chrome://extensions`，开启开发者模式，选择‘加载已解压的扩展程序’，选中含 `manifest.json` 的目录。”

## 4. 验收公开下载

打开正式版页面，确认有 **Latest** 标记且 **Assets** 中有同名 ZIP。用公开下载地址回读附件并与上传前的文件逐字节比较。只有比较通过且 SHA-256 一致，才交付发布页和安装包链接。

```bash
curl -fL "https://github.com/$REPO/releases/latest/download/$ASSET" -o "$OUT/download.zip"
cmp "$OUT/$ASSET" "$OUT/download.zip"
shasum -a 256 "$OUT/$ASSET" "$OUT/download.zip"
```

发布页固定地址为 `https://github.com/Kxmrg/pocket-evo-extension/releases/tag/X.Y.Z`。最后将版本文件和对应源码同步提交到 Evo 主仓库的 `chrome-extension/` 目录。
