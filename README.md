# Pocket Evo 站点导入插件

一个用于 Pocket Evo App 快速添加站点的 Chrome 扩展。它可以从已登录的站点读取导入所需的配置，并生成供 Pocket Evo 手机端扫码导入的二维码。

## 功能

- 架构分类为 NP、GZ、U3D、BTI、Other。
- 支持 NexusPHP、Gazelle、UNIT3D、BtiTracker；独立分类按精确域名识别朱雀、MT、海胆、SunnyPT、Rousi、Yema、Cola、BeyondHD、ExoticaZ、FileList、Cinemageddon、HDBits、KG、TorrentLeech、Ying，未知域名明确提示。
- Gazelle 支持 AlphaRatio、Anthelion、BroadcasTheNet、BrokenStones、DICMusic、GazelleGames、HD-F、PassThePopcorn、Redacted、Empornium、Great Poster Wall。导入 Cookie 与 UA；只接受资源列表入口，保留原站平铺/分组参数，不导入详情、下载或管理动作。
- UNIT3D 支持 LST（lst.gg）和 SeedPool（seedpool.org）的修改版，按域名识别并导入 Cookie 与 UA。
- UNIT3D 入口统一使用清单模式 `view=list`，保留分类等筛选参数；BeyondHD 使用独立架构和原生 `/torrents`、分类入口。两者导入 Cookie 与 UA，不需要 API Token。
- Ying 影视与音乐入口自动转换为 `_t.php` 种子清单模式，保留筛选参数；使用 Cookie 与 UA，无需 API Token。
- Yema 的 Hash 分类地址转换为 Evo 逻辑入口，保留分类筛选参数。
- 从同源导航识别默认资源入口（包括 TTG 的 `/browse.php`），允许添加分类入口。
- 站点名、入口、标签、凭据按 Evo 限制校验，生成前提示字段错误。
- MT 单独导入 API Key、UID、Auth、DID、VID；Tnode 不导入临时 CSRF。
- 二维码采用 `pocket-evo://import/site?v=1&data=…`，JSON 协议 `pocket-evo.site` v1，UTF-8 → raw DEFLATE → Base64URL。
- 数据为 `site.family/name/address/entries/userAgent/tags/downloadTags/secrets`；凭据仅放 `secrets`。需配合支持 Evo 协议的新版应用。

## 开发

需要 Node.js 24 或兼容版本。

```bash
npm install
npm test
npm run build
```

构建产物位于 `dist/` 目录。

## 安装

1. 运行 `npm run build`；
2. 在 Chrome 中打开 `chrome://extensions`；
3. 开启“开发者模式”；
4. 点击“加载已解压的扩展程序”；
5. 选择构建后的 `dist/` 目录。

插件需要 Chrome 132 或更高版本。打开 PT 站页面后，点击插件图标即可在侧边栏中读取和编辑配置。

## 隐私与安全

- 插件不会把站点配置或凭据发送到网络；
- 配置和凭据只保留在当前侧边栏内存中；
- Cookie、Token、UID 和 Passkey 默认遮挡；
- 二维码包含站点登录凭据，请勿截图或分享；
- 二维码的压缩编码不是加密。

为完成核心功能，插件需要读取当前 HTTP/HTTPS 站点的页面和 Cookie 数据。

## License

本项目使用 [MIT License](LICENSE) 开源。
