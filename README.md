# 词语小森林 · Word Grove

一个给小学生的自适应打字游戏。语文词汇和英语词汇分开练习，中文看拼音敲字母，带打字音效、成长等级和星星奖励。

纯静态网页，**无需安装、无需后端、无需构建**，可以直接放到 GitHub Pages。

![词语小森林首页](assets/preview-home.jpg)

![语文拼音打字界面](assets/preview-game.jpg)

## 功能

- **语文 / 英语分开**：语文 250 个词，英语 165 个词，来自 `语文词汇.txt` 和 `英语词汇.txt`。
- **中文拼音提示**：每个汉字上方显示带声调拼音，当前要打的字会高亮。
- **自适应难度**：5 个成长等级（小种子 → 小嫩芽 → 小树苗 → 小树 → 大树）。系统会根据正确率和每局表现升降难度，并优先复习错过的词。
- **有乐趣**：小狐狸小栗陪练、连击、星星、彩纸、升级和每轮战报。
- **打字音效**：使用 Web Audio API 实时合成按键、答对、答错、连击和过关音效，不需要任何音频文件；右上角可静音。
- **两种输入方式**：实体键盘直接打字，也可以点屏幕小键盘（平板 / 手机可用）。
- **自动保存**：星星、等级、词语记录保存在本机 `localStorage`，不需要登录。
- **零外部依赖**：不请求外部字体、图片或音频，断网时只要页面已加载，仍可继续玩。

## 怎么玩

### 语文模式

显示词语和拼音，例如：

```text
shān  pō
山    坡
```

在键盘上连续输入 `shanpo` 即可，**声调不用打，拼音之间不用空格**。拼音里的 `ü` 用 `V` 键输入（如 `旅行` 输入 `lvxing`）。

### English 模式

直接敲出屏幕上的单词或句子。**大小写都可以**，但空格和标点需要敲出来，例如 `Good morning.`。

## 本地预览

最简单：直接双击 `index.html` 打开。

如果浏览器限制本地文件，可以在项目文件夹运行：

```bash
python -m http.server 8000
```

然后打开 <http://localhost:8000>。

## 部署到 GitHub Pages

1. 新建一个 GitHub 仓库，把整个文件夹推送上去：
   ```bash
   git init
   git add .
   git commit -m "Add Word Grove typing game"
   git branch -M main
   git remote add origin https://github.com/你的用户名/你的仓库.git
   git push -u origin main
   ```
2. 打开仓库的 **Settings → Pages**。
3. **Build and deployment** 选择 **Deploy from a branch**。
4. Branch 选择 `main`，目录选择 `/ (root)`，点击 **Save**。
5. 等一两分钟，访问 `https://你的用户名.github.io/你的仓库/`。

所有路径都是相对路径，不需要修改配置，也不需要构建步骤。

## 文件结构

```text
.
├── index.html              # 页面入口
├── assets/
│   ├── css/style.css       # 全部样式、动画和响应式布局
│   ├── js/app.js           # 游戏逻辑、自适应算法、音效、存档
│   ├── js/data.js          # 内嵌词库和拼音数据
│   ├── preview-home.jpg    # README 预览图
│   ├── preview-game.jpg    # README 预览图
│   └── favicon.svg
├── 语文词汇.txt             # 原始词汇表
├── 英语词汇.txt             # 原始词汇表
├── .nojekyll               # GitHub Pages 跳过 Jekyll
├── .gitignore              # 排除本地课本参考照片
└── README.md
```

`assets/js/data.js` 已经包含全部词汇和拼音，网页运行时**不会**去读取 `语文词汇.txt` / `英语词汇.txt`，所以把网页单独部署也不会缺数据。

## 说明

- 拼音使用离线生成的数据；`ü` 类拼音的键入键为 `v`。
- 音效在第一次点击「开始种树 / 开始探险」后才会启用（浏览器自动播放策略）。
- 进度只保存在当前浏览器、当前设备。清除浏览器站点数据会一起清除。
- 推荐使用较新的 Chrome、Edge、Safari 或 Firefox。

## 致谢

- 拼音数据由 [pinyin-pro](https://github.com/zh-lx/pinyin-pro)（MIT License）辅助生成，另对个别多音字和轻声词做了人工校正。
- 页面不使用任何外部字体、图片或音频资源。

---

给小栗一颗星星吧 ⭐
