# 网页视频网页全屏插件 发布与托管指南 (Publishing Guide)

本指南将协助您将开发完成的 Chrome 插件代码托管到 **GitHub**，并打包发布至 **Chrome Web Store 官方扩展商店**。

工作区内已自动为您完成了以下准备工作：
1. **本地 Git 仓库已初始化**，且已完成首次代码提交（包含 `.gitignore` 以自动忽略压缩包及系统缓存）。
2. **商店发布压缩包已生成**：根目录下已生成 `videofull.zip` 压缩包，此包仅包含插件运行所需文件，体积轻量，可直接上传。

---

## 🖥️ 第一部分：发布至 GitHub 托管仓库

您可以将代码推送到您的个人 GitHub 仓库中，以便共享、进行版本管理或接受社区反馈。

### 步骤 1：在 GitHub 上创建一个新的空仓库
1. 打开浏览器登录 [GitHub](https://github.com/)。
2. 点击右上角 **`+`** 按钮，选择 **New repository**。
3. 填入仓库名称（推荐：`chrome-video-fullwindow`）。
4. **注意**：不要勾选 "Add a README file"、"Add .gitignore" 或 "Choose a license"（因为本地已经生成并配置好了这些文件，保持仓库为空即可）。
5. 点击 **Create repository**。

### 步骤 2：在本地终端推送代码到 GitHub
打开您的终端（可在工作区根目录 `/Users/william/Project/Chrome/videofull` 下执行），运行以下命令将本地 Git 提交推送到云端：

```bash
# 1. 关联您刚创建的 GitHub 远程仓库 (将下方的链接替换为您创建的实际仓库链接)
git remote add origin https://github.com/您的用户名/chrome-video-fullwindow.git

# 2. 将主分支重命名为 main
git branch -M main

# 3. 推送代码至 GitHub
git push -u origin main
```

### 步骤 3：在 GitHub 上发布 Release (版本包)
为了让其他用户能直接下载打包好的 `videofull.zip` 离线使用：
1. 打开 GitHub 仓库主页，点击右侧的 **Releases** -> **Create a new release**。
2. 填写版本号（例如 `v1.0.0`），标题可写 `First stable release`。
3. 拖拽根目录下的 **`videofull.zip`** 到附件上传区域中。
4. 点击 **Publish release**。

---

## 🛍️ 第二部分：发布至 Chrome Web Store 开发者商店

将插件发布到 Chrome 商店，能够使全球用户一键搜索并安全安装，且插件后续的更新会自动推送到用户的浏览器中。

### 步骤 1：注册开发者账户
1. 访问并登录 [Chrome 应用商店开发者控制台 (Chrome Web Store Developer Console)](https://chrome.google.com/webstore/devconsole)。
2. 若是首次登录，您需要签署开发者协议，并支付一次性的开发者注册费（5 美元，Google 官方收取的全球开发者身份验证费）。

### 步骤 2：上传压缩包
1. 进入控制台主页，点击右上角的 **“添加新商品” (New Item)**。
2. 拖入或选择上传我们已经打包好的 **`videofull.zip`** 压缩文件。

### 步骤 3：完善商店商品详情 (Store Listing)
在控制台的“商品详情”页面中，填写以下信息：
1. **基础信息**：
   - **名称**：`网页视频全屏 (Web Video Full Window)`
   - **简短说明**：`将网页播放的视频一键扩展至整个窗口，隐藏其它干扰元素。完美保留弹幕、原生字幕和倍速控制。`
   - **详细说明**：可将 `README.md` 中的“🌟 核心功能”部分复制进去。
2. **媒体资源 (重要)**：
   - **扩展程序图标**：需要一张 `128x128` 像素的 **PNG** 格式图标（注意：商店页面不支持直接上传 SVG 图标。您可以使用在线工具或浏览器直接打开 `icons/icon.svg` 并截图/导出为 PNG 文件后上传）。
   - **屏幕截图**：至少上传一张展示插件运行效果的截图（例如打开 Bilibili 全屏后的效果图）。
3. **分类与类别**：
   - **类别**：建议选择 `实用工具 (Utilities)` 或 `娱乐 (Entertainment)`。
   - **分级**：选择适合大众人群。

### 步骤 4：隐私权和权限声明 (Privacy & Permissions)
由于我们的插件包含对网页 DOM 注入和设置同步的功能，需要在隐私权页面声明：
1. **权限使用合理性说明**：
   - `activeTab` / `scripting`：用于在用户主动触发（点击插件图标或使用快捷键）时，向当前网页注入全屏定位类 CSS 并临时调整元素层级，以扩展视频范围。
   - `storage`：用于在本地保存用户对全屏模式（智能播放器/纯视频模式）和功能开关的偏好设置。
2. **单一用途声明 (Single Purpose)**：
   - 填写：`The extension provides a window-level fullscreen viewing experience for web videos while filtering out background distractions.`（为网页视频提供窗口级全屏观看体验，同时过滤背景干扰）。
3. **数据安全承诺**：
   - 勾选声明本插件不收集、不上传任何个人数据，所有操作均在本地进行。

### 步骤 5：提交审核
1. 检查所有必填项完成，在右上角点击 **“提交审核” (Submit for Review)**。
2. 审核一般需要 1 到 5 个工作日，通过后插件便会上架商店，您可以直接把商店链接分享给其他用户一键安装。

---

## 🛠️ 常见更新与维护步骤

如果以后您想对插件代码进行升级：
1. 在本地修改代码。
2. 运行压缩命令重新打包（例如：`zip -r videofull.zip manifest.json background.js content.js content.css popup.html popup.css popup.js icons/`）。
3. 在 Chrome Web Store 控制台中选择该项目，点击 **“上传新版本” (Package -> Upload new package)**。
4. 更改 `manifest.json` 中的 `"version"` 字段（例如修改为 `"1.0.1"`），并提交审核即可。
